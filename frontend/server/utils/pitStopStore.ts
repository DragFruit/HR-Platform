import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { writeJsonAtomic, createMutationQueue } from './atomicJson';
import type {
  PitStopCheckpointId,
  PitStopCheckpointStatus,
  PitStopPair,
  PitStopPlayerProgress,
  PitStopPlayerRole,
  PitStopStoreState
} from '../../app/events/pit-stop-14/types';
import { PIT_STOP_EASTER_CODE } from '../../app/events/pit-stop-14/copy';

const DATA_FILE = join(process.cwd(), 'server/data/pit-stop-14.json');
const enqueue = createMutationQueue();

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

async function ensureFile() {
  await mkdir(join(process.cwd(), 'server/data'), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeJsonAtomic(DATA_FILE, defaultPitStopState());
  }
}

export async function readPitStop(): Promise<PitStopStoreState> {
  await ensureFile();
  try {
    const raw = JSON.parse(await readFile(DATA_FILE, 'utf8')) as Partial<PitStopStoreState>;
    return {
      pairs: Array.isArray(raw.pairs) ? raw.pairs : [],
      players: Array.isArray(raw.players) ? raw.players : [],
      easterCode: typeof raw.easterCode === 'string' ? raw.easterCode : PIT_STOP_EASTER_CODE,
      finalizedAt: typeof raw.finalizedAt === 'string' ? raw.finalizedAt : null
    };
  } catch {
    return defaultPitStopState();
  }
}

export async function writePitStop(state: PitStopStoreState): Promise<void> {
  await writeJsonAtomic(DATA_FILE, state);
}

export async function mutatePitStop<T>(fn: (state: PitStopStoreState) => T | Promise<T>): Promise<T> {
  return enqueue(async () => {
    const state = await readPitStop();
    const result = await fn(state);
    await writePitStop(state);
    return result;
  });
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
