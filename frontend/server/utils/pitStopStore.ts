import { getDeployAppEnv } from './appEnv';
import type {
  PitStopCheckpointId,
  PitStopCheckpointStatus,
  PitStopPair,
  PitStopPlayerProgress,
  PitStopPlayerRole,
  PitStopStoreState
} from '../../app/events/pit-stop-14/types';
import { PIT_STOP_EASTER_CODE } from '../../app/events/pit-stop-14/copy';
import type { KeyedListWriteContext } from '../db/repositories/keyedList';
import type { KeyedStateDef, RawState } from '../db/repositories/keyedState';
import { defineStateFile } from '../db/repositories/stateFile';
import { engagementJsonImports } from '../db/schema';
import { PIT_STOP_STATE_DEF, engagementDbFlag } from '../engagement/domain';

/** QA-пара на стейдже: Драго + Музыка (bitrix_user_id). */
export const PIT_STOP_STAGING_QA = {
  a: { id: 2684, name: 'Драго Станислава' },
  b: { id: 2353, name: 'Музыка Сергей' }
} as const;

export const defaultPitStopState = (): PitStopStoreState => ({
  pairs: [],
  players: [],
  easterCode: PIT_STOP_EASTER_CODE,
  finalizedAt: null
});

function randomCipher(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function pickGlowCells(count: number, exclude: Set<number>): number[] {
  const pool = Array.from({ length: 16 }, (_, i) => i).filter((i) => !exclude.has(i));
  const picked: number[] = [];
  while (picked.length < count && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]!);
  }
  return picked.sort((a, b) => a - b);
}

export function createPair(
  userA: { id: number; name: string },
  userB: { id: number; name: string }
): PitStopPair {
  const glowA = pickGlowCells(4, new Set());
  const glowB = pickGlowCells(4, new Set(glowA));
  return {
    id: `pair-${userA.id}-${userB.id}`,
    userIdA: userA.id,
    userIdB: userB.id,
    nameA: userA.name,
    nameB: userB.name,
    cipher: randomCipher(),
    assemblyTurn: 'A',
    assemblyStep: 0,
    ignitionHeldBy: [],
    blindRoleA: Math.random() < 0.5 ? 'navigator' : 'pilot',
    blindX: 0,
    blindY: 0,
    blindStartedAt: null,
    puzzleGlowA: glowA,
    puzzleGlowB: glowB,
    puzzlePressedA: [],
    puzzlePressedB: []
  };
}

export function emptyPlayer(userId: number, name: string): PitStopPlayerProgress {
  return {
    userId,
    name,
    pairId: null,
    role: null,
    isRemote: false,
    checkpoints: {}
  };
}

/** Нормализация стора (как до этапа 8), одна на оба бэкенда. */
export function normalizePitStopState(raw: Partial<PitStopStoreState> | null | undefined): PitStopStoreState {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    pairs: Array.isArray(r.pairs) ? r.pairs : [],
    players: Array.isArray(r.players) ? r.players : [],
    easterCode: typeof r.easterCode === 'string' ? r.easterCode : PIT_STOP_EASTER_CODE,
    finalizedAt: typeof r.finalizedAt === 'string' ? r.finalizedAt : null
  };
}

export const PIT_STOP_STATE_FULL_DEF: KeyedStateDef = {
  ...PIT_STOP_STATE_DEF,
  normalize: (raw) => normalizePitStopState(raw as Partial<PitStopStoreState>)
};

/**
 * Этап 8: DB_ENGAGEMENT=1 и задан DATABASE_URL → Postgres (схема engagement), иначе
 * server/data/pit-stop-14.json. Флаг стоит только на стейдже. Публичный API не менялся.
 */
export const pitStopFile = defineStateFile({
  fileName: 'pit-stop-14.json',
  label: 'пит-стоп',
  logTag: 'pit-stop',
  flag: engagementDbFlag,
  def: PIT_STOP_STATE_FULL_DEF,
  jsonImports: engagementJsonImports,
  defaultRaw: () => defaultPitStopState() as unknown as RawState,
  // битый файл стор читал как пустое состояние
  onBadJson: () => defaultPitStopState() as unknown as RawState
});

export async function readPitStop(): Promise<PitStopStoreState> {
  return normalizePitStopState((await (await pitStopFile.repo()).read()) as Partial<PitStopStoreState>);
}

export async function writePitStop(state: PitStopStoreState, ctx: KeyedListWriteContext = {}): Promise<void> {
  await (await pitStopFile.repo()).mutate(async () => ({ next: state as unknown as RawState, result: undefined }), ctx);
}

/**
 * На стейдже всегда держим пару Драго↔Музыка для прогона всех этапов.
 * Возвращает true, если стор изменили.
 */
export function ensureStagingQaPair(state: PitStopStoreState): boolean {
  if (getDeployAppEnv() !== 'staging') return false;

  const { a, b } = PIT_STOP_STAGING_QA;
  const qaPairId = `pair-${a.id}-${b.id}`;
  let changed = false;

  let playerA = findPlayer(state, a.id);
  let playerB = findPlayer(state, b.id);

  if (!playerA) {
    playerA = emptyPlayer(a.id, a.name);
    state.players.push(playerA);
    changed = true;
  }
  if (!playerB) {
    playerB = emptyPlayer(b.id, b.name);
    state.players.push(playerB);
    changed = true;
  }

  if (playerA.name !== a.name) {
    playerA.name = a.name;
    changed = true;
  }
  if (playerB.name !== b.name) {
    playerB.name = b.name;
    changed = true;
  }

  const existingQa = state.pairs.find(
    (p) =>
      (p.userIdA === a.id && p.userIdB === b.id) || (p.userIdA === b.id && p.userIdB === a.id)
  );

  if (existingQa && playerA.pairId === existingQa.id && playerB.pairId === existingQa.id) {
    return changed;
  }

  const stalePairIds = new Set<string>();
  if (playerA.pairId && playerA.pairId !== existingQa?.id) stalePairIds.add(playerA.pairId);
  if (playerB.pairId && playerB.pairId !== existingQa?.id) stalePairIds.add(playerB.pairId);
  if (stalePairIds.size) {
    state.pairs = state.pairs.filter((p) => !stalePairIds.has(p.id));
    changed = true;
  }

  if (existingQa) {
    playerA.pairId = existingQa.id;
    playerB.pairId = existingQa.id;
    if (existingQa.userIdA === a.id) {
      playerA.role = 'A';
      playerB.role = 'B';
      existingQa.nameA = a.name;
      existingQa.nameB = b.name;
    } else {
      playerA.role = 'B';
      playerB.role = 'A';
      existingQa.nameA = b.name;
      existingQa.nameB = a.name;
    }
    return true;
  }

  const pair = createPair({ id: a.id, name: a.name }, { id: b.id, name: b.name });
  pair.id = qaPairId;
  state.pairs.push(pair);
  playerA.pairId = pair.id;
  playerA.role = 'A';
  playerB.pairId = pair.id;
  playerB.role = 'B';
  return true;
}

/**
 * Атомарное «прочитать → изменить → записать» (очередь репозитория; в Postgres ещё транзакция
 * под advisory lock). Ошибка в fn → ничего не записано. ctx — кто и почему (аудит).
 */
export async function mutatePitStop<T>(
  fn: (state: PitStopStoreState) => T | Promise<T>,
  ctx: KeyedListWriteContext = {}
): Promise<T> {
  return (await pitStopFile.repo()).mutate(async (raw) => {
    const state = normalizePitStopState(raw as Partial<PitStopStoreState>);
    ensureStagingQaPair(state);
    const result = await fn(state);
    return { next: state as unknown as RawState, result };
  }, ctx);
}

/**
 * Чтение с гарантией QA-пары на стейдже. Пишет, только если пару правда пришлось поправить
 * (раньше каждый GET переписывал файл; теперь опрос состояния не ходит в транзакцию зря).
 */
export async function readPitStopForRequest(): Promise<PitStopStoreState> {
  const state = await readPitStop();
  if (getDeployAppEnv() !== 'staging') return state;
  const probe = structuredClone(state);
  if (!ensureStagingQaPair(probe)) return state;
  return mutatePitStop((s) => s, { reason: 'pit-stop:staging-qa-pair' });
}

export function findPlayer(state: PitStopStoreState, userId: number) {
  return state.players.find((p) => p.userId === userId) ?? null;
}

export function findPair(state: PitStopStoreState, pairId: string | null) {
  if (!pairId) return null;
  return state.pairs.find((p) => p.id === pairId) ?? null;
}

export function partnerOf(
  pair: PitStopPair,
  userId: number
): { partnerId: number; partnerName: string; role: PitStopPlayerRole } {
  if (pair.userIdA === userId) {
    return { partnerId: pair.userIdB, partnerName: pair.nameB, role: 'A' };
  }
  return { partnerId: pair.userIdA, partnerName: pair.nameA, role: 'B' };
}

export function myCipherHalf(pair: PitStopPair, role: PitStopPlayerRole): string {
  return role === 'A' ? pair.cipher.slice(0, 4) : pair.cipher.slice(4);
}

export function setCheckpointStatus(
  player: PitStopPlayerProgress,
  id: PitStopCheckpointId,
  status: PitStopCheckpointStatus
) {
  player.checkpoints = { ...player.checkpoints, [id]: status };
}

export function completedCount(player: PitStopPlayerProgress): number {
  return Object.values(player.checkpoints).filter((s) => s === 'done').length;
}
