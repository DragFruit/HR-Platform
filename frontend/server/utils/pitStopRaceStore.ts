import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeJsonAtomic, createMutationQueue } from './atomicJson';
import { getDeployAppEnv } from './appEnv';
import {
  MAX_LAP_MS,
  MIN_LAP_MS,
  isCarColorId,
  type CarColorId
} from '../../app/events/pit-stop-14/trackDrive';
import { isPitStopGameStopped, PIT_STOP_STOP_AT } from '../../app/events/pit-stop-14/timeline';

const DATA_FILE = join(process.cwd(), 'server/data/pit-stop-race.json');
const enqueue = createMutationQueue();

/** Каждое улучшение личного рекорда — для срезов таблицы по расписанию. */
type BestImprovement = { ms: number; at: string };

export type PitStopRaceRecord = {
  userId: number;
  name: string;
  department: string;
  bestMs: number;
  color: CarColorId;
  laps: number;
  bestAt: string;
  updatedAt: string;
  history?: BestImprovement[];
};

export type PitStopRaceWinner = {
  userId: number;
  rank: number;
  name: string;
  bestMs: number;
};

type PitStopRaceState = {
  records: PitStopRaceRecord[];
  winners?: PitStopRaceWinner[];
  finalizedAt?: string | null;
};

async function readState(): Promise<PitStopRaceState> {
  try {
    const raw = JSON.parse(await readFile(DATA_FILE, 'utf8')) as Partial<PitStopRaceState>;
    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      winners: Array.isArray(raw.winners) ? raw.winners : undefined,
      finalizedAt: typeof raw.finalizedAt === 'string' ? raw.finalizedAt : null
    };
  } catch {
    return { records: [], winners: undefined, finalizedAt: null };
  }
}

export async function readRaceRecords(): Promise<PitStopRaceRecord[]> {
  return (await readState()).records;
}

/** QA-аккаунты стейджа — не показываем в таблице (тестовые заезды). */
const STAGING_LEADERBOARD_EXCLUDE_USER_IDS = new Set([2353, 2684]);

export function raceRecordsForLeaderboard(records: PitStopRaceRecord[]): PitStopRaceRecord[] {
  if (getDeployAppEnv() !== 'staging') return records;
  return records.filter((r) => !STAGING_LEADERBOARD_EXCLUDE_USER_IDS.has(r.userId));
}

export const isValidLapMs = (ms: unknown): ms is number =>
  typeof ms === 'number' && Number.isFinite(ms) && ms >= MIN_LAP_MS && ms <= MAX_LAP_MS;

const historyOf = (r: PitStopRaceRecord): BestImprovement[] =>
  r.history?.length ? r.history : [{ ms: r.bestMs, at: r.bestAt }];

/** Лучший круг пилота на момент среза; null — до среза кругов не было. */
export function bestAsOf(r: PitStopRaceRecord, cutoff: Date): { ms: number; at: string } | null {
  const t = cutoff.getTime();
  let best: BestImprovement | null = null;
  for (const h of historyOf(r)) {
    if (new Date(h.at).getTime() > t) continue;
    if (!best || h.ms < best.ms) best = h;
  }
  return best;
}

/**
 * Срезы таблицы по Москве (UTC+3, без перехода на летнее время):
 * 10:00, 12:00 … 22:00 и 00:00. С 00:00 до 10:00 таблица не меняется.
 */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const PUBLISH_HOURS = [0, 10, 12, 14, 16, 18, 20, 22];

export function leaderboardSlots(now: Date = new Date()): { publishedAt: Date; nextAt: Date } {
  const msk = new Date(now.getTime() + MSK_OFFSET_MS);
  const dayStartMsk = Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate());
  const h = msk.getUTCHours();
  const lastHour = [...PUBLISH_HOURS].reverse().find((x) => x <= h) ?? 0;
  const nextHour = PUBLISH_HOURS.find((x) => x > h);
  const toUtc = (dayMs: number, hour: number) => new Date(dayMs + hour * 3600_000 - MSK_OFFSET_MS);
  return {
    publishedAt: toUtc(dayStartMsk, lastHour),
    nextAt: nextHour == null ? toUtc(dayStartMsk + 86400_000, 0) : toUtc(dayStartMsk, nextHour)
  };
}

const computeTop3Winners = (records: PitStopRaceRecord[]): PitStopRaceWinner[] => {
  const cutoff = new Date(PIT_STOP_STOP_AT);
  return raceRecordsForLeaderboard(records)
    .map((r) => ({ r, best: bestAsOf(r, cutoff) }))
    .filter((x): x is { r: PitStopRaceRecord; best: { ms: number; at: string } } => x.best != null)
    .sort((a, b) => a.best.ms - b.best.ms || a.best.at.localeCompare(b.best.at))
    .slice(0, 3)
    .map(({ r, best }, i) => ({
      userId: r.userId,
      rank: i + 1,
      name: r.name,
      bestMs: best.ms
    }));
};

/**
 * После стопа ивента один раз фиксирует топ-3 для ачивки `pit-stop-14`.
 * Вызывается лениво с API — без отдельного крона.
 */
export async function ensureRaceFinalized(now: Date = new Date()): Promise<{
  winners: PitStopRaceWinner[];
  finalizedAt: string | null;
}> {
  if (!isPitStopGameStopped(now)) {
    return { winners: [], finalizedAt: null };
  }
  return enqueue(async () => {
    const state = await readState();
    if (state.finalizedAt && Array.isArray(state.winners)) {
      return { winners: state.winners, finalizedAt: state.finalizedAt };
    }
    const winners = computeTop3Winners(state.records);
    const finalizedAt = new Date().toISOString();
    state.winners = winners;
    state.finalizedAt = finalizedAt;
    await writeJsonAtomic(DATA_FILE, state);
    return { winners, finalizedAt };
  });
}

export async function submitLap(input: {
  userId: number;
  name: string;
  department: string;
  ms: number;
  color: unknown;
}): Promise<{ record: PitStopRaceRecord; improved: boolean }> {
  return enqueue(async () => {
    const state = await readState();
    const now = new Date().toISOString();
    const ms = Math.round(input.ms);
    const color: CarColorId = isCarColorId(input.color) ? input.color : 'violet';
    let rec = state.records.find((r) => r.userId === input.userId);
    let improved = false;
    if (!rec) {
      rec = {
        userId: input.userId,
        name: input.name,
        department: input.department,
        bestMs: ms,
        color,
        laps: 1,
        bestAt: now,
        updatedAt: now,
        history: [{ ms, at: now }]
      };
      state.records.push(rec);
      improved = true;
    } else {
      rec.history = historyOf(rec);
      rec.name = input.name;
      rec.department = input.department;
      rec.laps += 1;
      rec.updatedAt = now;
      rec.color = color;
      if (ms < rec.bestMs) {
        rec.bestMs = ms;
        rec.bestAt = now;
        rec.history.push({ ms, at: now });
        improved = true;
      }
    }
    await writeJsonAtomic(DATA_FILE, state);
    return { record: rec, improved };
  });
}
