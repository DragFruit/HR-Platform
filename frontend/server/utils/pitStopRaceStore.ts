import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeJsonAtomic, createMutationQueue } from './atomicJson';
import {
  MAX_LAP_MS,
  MIN_LAP_MS,
  isCarColorId,
  type CarColorId
} from '../../app/events/pit-stop-14/trackDrive';

const DATA_FILE = join(process.cwd(), 'server/data/pit-stop-race.json');
const enqueue = createMutationQueue();

export type PitStopRaceRecord = {
  userId: number;
  name: string;
  department: string;
  bestMs: number;
  color: CarColorId;
  laps: number;
  bestAt: string;
  updatedAt: string;
};

type PitStopRaceState = { records: PitStopRaceRecord[] };

async function readState(): Promise<PitStopRaceState> {
  try {
    const raw = JSON.parse(await readFile(DATA_FILE, 'utf8')) as Partial<PitStopRaceState>;
    return { records: Array.isArray(raw.records) ? raw.records : [] };
  } catch {
    return { records: [] };
  }
}

export const sortRecords = (records: PitStopRaceRecord[]) =>
  [...records].sort((a, b) => a.bestMs - b.bestMs || a.bestAt.localeCompare(b.bestAt));

export async function readRaceRecords(): Promise<PitStopRaceRecord[]> {
  return sortRecords((await readState()).records);
}

export const isValidLapMs = (ms: unknown): ms is number =>
  typeof ms === 'number' && Number.isFinite(ms) && ms >= MIN_LAP_MS && ms <= MAX_LAP_MS;

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
        updatedAt: now
      };
      state.records.push(rec);
      improved = true;
    } else {
      rec.name = input.name;
      rec.department = input.department;
      rec.laps += 1;
      rec.updatedAt = now;
      rec.color = color;
      if (ms < rec.bestMs) {
        rec.bestMs = ms;
        rec.bestAt = now;
        improved = true;
      }
    }
    await writeJsonAtomic(DATA_FILE, state);
    return { record: rec, improved };
  });
}
