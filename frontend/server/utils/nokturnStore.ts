import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createMutationQueue, writeJsonAtomic } from './atomicJson';
import type {
  NokturnBoard,
  NokturnStageId,
  NokturnSuspectId
} from '../../app/events/nokturn/types';
import { NOKTURN_STAGE_IDS } from '../../app/events/nokturn/timeline';
import { NOKTURN_FIXTURES } from '../../app/events/nokturn/content';

const DATA_FILE = join(process.cwd(), 'server/data/nokturn.json');
const enqueue = createMutationQueue();

/** Максимум нитей на доске (раздел 7 спеки). */
export const NOKTURN_THREAD_LIMIT = 40;

/** Попыток на мини-игру; после третьей улики выдаются без баллов. */
export const NOKTURN_MINIGAME_ATTEMPTS = 3;

export type NokturnStageProgress = {
  /** Сколько раз игрок запускал мини-игру. */
  attempts: number;
  solved: boolean;
  /** Улики выданы: мини-игра пройдена либо попытки исчерпаны. */
  released: boolean;
  releasedAt?: string;
  vote?: {
    suspectId: NokturnSuspectId;
    at: string;
    points: number;
    late: boolean;
  };
};

export type NokturnPlayer = {
  userId: number;
  name: string;
  board: NokturnBoard;
  stages: Record<string, NokturnStageProgress>;
  /** Вопрос пятницы «как это было сделано». */
  mechanics?: {
    optionId: number;
    correct: boolean;
    points: number;
    late: boolean;
    at: string;
  };
  /** Обстановка доски уже разложена (карточка дела и шесть портретов). */
  fixturesSeeded?: boolean;
  updatedAt: string;
};

type NokturnState = {
  players: NokturnPlayer[];
};

export function emptyNokturnStageProgress(): NokturnStageProgress {
  return { attempts: 0, solved: false, released: false };
}

export function emptyNokturnPlayer(userId: number, name: string): NokturnPlayer {
  return {
    userId,
    name,
    board: { items: fixtureItems(), threads: [] },
    stages: {},
    fixturesSeeded: true,
    updatedAt: new Date().toISOString()
  };
}

/** Карточка дела и шесть портретов на местах по умолчанию. */
function fixtureItems() {
  return NOKTURN_FIXTURES.map((f) => ({ id: f.id, x: f.x, y: f.y }));
}

/**
 * Разовая раскладка обстановки для игроков, заведённых до её появления.
 * Флаг нужен, чтобы не возвращать карточки тому, кто их сам убрал с доски.
 */
export function ensureFixtures(player: NokturnPlayer): boolean {
  if (player.fixturesSeeded) return false;
  const present = new Set(player.board.items.map((i) => i.id));
  for (const f of fixtureItems()) {
    if (!present.has(f.id)) player.board.items.push(f);
  }
  player.fixturesSeeded = true;
  return true;
}

function normalizeBoard(raw: unknown): NokturnBoard {
  const src = (raw || {}) as Partial<NokturnBoard>;
  const items = Array.isArray(src.items) ? src.items : [];
  const threads = Array.isArray(src.threads) ? src.threads : [];
  return {
    items: items
      .filter((i) => i && typeof i.id === 'string')
      .map((i) => ({ id: i.id, x: clamp01(i.x), y: clamp01(i.y) })),
    threads: threads
      .filter(
        (t) => t && typeof t.id === 'string' && typeof t.from === 'string' && typeof t.to === 'string'
      )
      .slice(0, NOKTURN_THREAD_LIMIT)
      .map((t) => ({ id: t.id, from: t.from, to: t.to }))
  };
}

function clamp01(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function normalizePlayer(raw: unknown): NokturnPlayer | null {
  const src = (raw || {}) as Partial<NokturnPlayer>;
  const userId = Number(src.userId);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  const stages: Record<string, NokturnStageProgress> = {};
  for (const id of NOKTURN_STAGE_IDS) {
    const s = (src.stages || {})[String(id)];
    if (!s) continue;
    stages[String(id)] = {
      attempts: Math.max(0, Number(s.attempts) || 0),
      solved: Boolean(s.solved),
      released: Boolean(s.released),
      releasedAt: typeof s.releasedAt === 'string' ? s.releasedAt : undefined,
      vote: s.vote
        ? {
            suspectId: s.vote.suspectId,
            at: s.vote.at,
            points: Number(s.vote.points) || 0,
            late: Boolean(s.vote.late)
          }
        : undefined
    };
  }
  return {
    userId,
    name: String(src.name || 'Сотрудник'),
    board: normalizeBoard(src.board),
    stages,
    fixturesSeeded: Boolean(src.fixturesSeeded),
    mechanics: src.mechanics
      ? {
          optionId: Number(src.mechanics.optionId) || 0,
          correct: Boolean(src.mechanics.correct),
          points: Number(src.mechanics.points) || 0,
          late: Boolean(src.mechanics.late),
          at: String(src.mechanics.at || '')
        }
      : undefined,
    updatedAt: String(src.updatedAt || new Date().toISOString())
  };
}

async function readState(): Promise<NokturnState> {
  try {
    const raw = JSON.parse(await readFile(DATA_FILE, 'utf8')) as Partial<NokturnState>;
    const players = Array.isArray(raw.players) ? raw.players : [];
    return {
      players: players.map(normalizePlayer).filter((p): p is NokturnPlayer => Boolean(p))
    };
  } catch {
    return { players: [] };
  }
}

export async function readNokturnState(): Promise<NokturnState> {
  return readState();
}

export async function readNokturnPlayers(): Promise<NokturnPlayer[]> {
  return (await readState()).players;
}

/** Мутация под очередью — без гонок read-modify-write на одном файле. */
export async function mutateNokturn<T>(
  fn: (state: NokturnState) => T | Promise<T>
): Promise<T> {
  return enqueue(async () => {
    const state = await readState();
    const result = await fn(state);
    await writeJsonAtomic(DATA_FILE, state);
    return result;
  });
}

export function findOrCreatePlayer(
  state: NokturnState,
  userId: number,
  name: string
): NokturnPlayer {
  let player = state.players.find((p) => p.userId === userId);
  if (!player) {
    player = emptyNokturnPlayer(userId, name);
    state.players.push(player);
  }
  if (name) player.name = name;
  ensureFixtures(player);
  player.updatedAt = new Date().toISOString();
  return player;
}

export function nokturnStageProgress(player: NokturnPlayer, id: NokturnStageId): NokturnStageProgress {
  const key = String(id);
  if (!player.stages[key]) player.stages[key] = emptyNokturnStageProgress();
  return player.stages[key];
}

export function playerPoints(player: NokturnPlayer): number {
  let sum = 0;
  for (const id of NOKTURN_STAGE_IDS) {
    sum += player.stages[String(id)]?.vote?.points ?? 0;
  }
  sum += player.mechanics?.points ?? 0;
  return sum;
}
