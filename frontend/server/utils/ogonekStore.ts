import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createMutationQueue, writeJsonAtomic } from './atomicJson';
import type {
  OgonekFeedItem,
  OgonekFeedKind,
  OgonekRecipe,
  OgonekSnowflake,
  OgonekThanks,
  OgonekToy
} from '../../app/events/ogonek/types';
import { OGONEK_LETTER_DELIVERY_AT } from '../../app/events/ogonek/timeline';

const DATA_FILE = join(process.cwd(), 'server/data/ogonek.json');
const enqueue = createMutationQueue();

/** Сетка игрушки и снежинки. Размеры жёсткие: по ним нарисован редактор. */
export const OGONEK_TOY_SIZE = 16;
export const OGONEK_SNOWFLAKE_SIZE = 15;
/** Длина ленты, которую храним. Старое не нужно: лента про «прямо сейчас». */
export const OGONEK_FEED_LIMIT = 120;
export const OGONEK_WISH_MAX = 120;
export const OGONEK_THANKS_MAX = 400;
export const OGONEK_LETTER_MAX = 4000;
export const OGONEK_RECIPE_MAX = 1200;

export type OgonekLetter = {
  id: string;
  userId: number;
  name: string;
  text: string;
  createdAt: string;
  deliverAt: string;
  delivered: boolean;
};

export type OgonekPlayer = {
  userId: number;
  name: string;
  department: string;
  /** Номера распечатанных окон. */
  opened: number[];
  /** Вилка воткнута — декор платформы горит. */
  plugged: boolean;
  /** Колпак на аватарке (окно 2). */
  hat: boolean;
  /** Песня года (окно 1) — до вечера не показывается никому. */
  song?: string;
  /** Записался на каток (окно 5). */
  skating?: boolean;
  /** Выбранный образ на Огонёк (окно 8). */
  dresscode?: string;
  toyId?: string;
  snowflakeId?: string;
  letterId?: string;
  recipeId?: string;
  /** За чей рецепт проголосовал. */
  recipeVote?: string;
  /** Сколько «спасибо» отправил. */
  thanksSent: number;
  updatedAt: string;
};

export type OgonekState = {
  players: OgonekPlayer[];
  toys: OgonekToy[];
  snowflakes: OgonekSnowflake[];
  recipes: (OgonekRecipe & { voters: number[] })[];
  thanks: OgonekThanks[];
  letters: OgonekLetter[];
  feed: OgonekFeedItem[];
};

function emptyState(): OgonekState {
  return { players: [], toys: [], snowflakes: [], recipes: [], thanks: [], letters: [], feed: [] };
}

export function emptyOgonekPlayer(userId: number, name: string, department: string): OgonekPlayer {
  return {
    userId,
    name,
    department,
    opened: [],
    plugged: false,
    hat: false,
    thanksSent: 0,
    updatedAt: new Date().toISOString()
  };
}

const str = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const clamp01 = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
};

/** Сетка пикселей: ровно size строк по size символов из палитры. */
export function normalizeOgonekPixels(raw: unknown, size: number): string[] | null {
  if (!Array.isArray(raw) || raw.length !== size) return null;
  const out: string[] = [];
  for (const row of raw) {
    const s = String(row ?? '');
    if (s.length !== size) return null;
    if (!/^[0-7.]+$/.test(s)) return null;
    out.push(s);
  }
  // Пустая сетка — не игрушка.
  if (!out.some((r) => /[0-7]/.test(r))) return null;
  return out;
}

function normalizeToy(raw: unknown): OgonekToy | null {
  const s = (raw || {}) as Partial<OgonekToy>;
  const pixels = normalizeOgonekPixels(s.pixels, OGONEK_TOY_SIZE);
  if (!pixels || !s.id) return null;
  return {
    id: String(s.id),
    userId: Number(s.userId) || 0,
    name: str(s.name, 80) || 'Сотрудник',
    department: str(s.department, 80),
    pixels,
    wish: str(s.wish, OGONEK_WISH_MAX),
    x: clamp01(s.x),
    y: clamp01(s.y),
    createdAt: str(s.createdAt, 40) || new Date().toISOString()
  };
}

function normalizeSnowflake(raw: unknown): OgonekSnowflake | null {
  const s = (raw || {}) as Partial<OgonekSnowflake>;
  const pixels = normalizeOgonekPixels(s.pixels, OGONEK_SNOWFLAKE_SIZE);
  if (!pixels || !s.id) return null;
  return {
    id: String(s.id),
    userId: Number(s.userId) || 0,
    name: str(s.name, 80) || 'Сотрудник',
    pixels,
    createdAt: str(s.createdAt, 40) || new Date().toISOString()
  };
}

async function readState(): Promise<OgonekState> {
  try {
    const raw = JSON.parse(await readFile(DATA_FILE, 'utf8')) as Partial<OgonekState>;
    const state = emptyState();
    for (const p of Array.isArray(raw.players) ? raw.players : []) {
      const userId = Number((p as OgonekPlayer)?.userId);
      if (!Number.isFinite(userId) || userId <= 0) continue;
      const src = p as Partial<OgonekPlayer>;
      state.players.push({
        userId,
        name: str(src.name, 80) || 'Сотрудник',
        department: str(src.department, 80),
        opened: Array.isArray(src.opened)
          ? [...new Set(src.opened.map(Number).filter((n) => n >= 1 && n <= 19))].sort((a, b) => a - b)
          : [],
        plugged: Boolean(src.plugged),
        hat: Boolean(src.hat),
        song: src.song ? str(src.song, 160) : undefined,
        skating: src.skating ? true : undefined,
        dresscode: src.dresscode ? str(src.dresscode, 80) : undefined,
        toyId: src.toyId ? String(src.toyId) : undefined,
        snowflakeId: src.snowflakeId ? String(src.snowflakeId) : undefined,
        letterId: src.letterId ? String(src.letterId) : undefined,
        recipeId: src.recipeId ? String(src.recipeId) : undefined,
        recipeVote: src.recipeVote ? String(src.recipeVote) : undefined,
        thanksSent: Math.max(0, Number(src.thanksSent) || 0),
        updatedAt: str(src.updatedAt, 40) || new Date().toISOString()
      });
    }
    state.toys = (Array.isArray(raw.toys) ? raw.toys : [])
      .map(normalizeToy)
      .filter((t): t is OgonekToy => Boolean(t));
    state.snowflakes = (Array.isArray(raw.snowflakes) ? raw.snowflakes : [])
      .map(normalizeSnowflake)
      .filter((s): s is OgonekSnowflake => Boolean(s));
    state.recipes = (Array.isArray(raw.recipes) ? raw.recipes : []).map((r) => {
      const s = r as Partial<OgonekRecipe & { voters: number[] }>;
      return {
        id: String(s.id || ''),
        userId: Number(s.userId) || 0,
        name: str(s.name, 80) || 'Сотрудник',
        department: str(s.department, 80),
        title: str(s.title, 120),
        text: str(s.text, OGONEK_RECIPE_MAX),
        votes: Math.max(0, Number(s.votes) || 0),
        voters: Array.isArray(s.voters) ? s.voters.map(Number).filter(Number.isFinite) : [],
        createdAt: str(s.createdAt, 40) || new Date().toISOString()
      };
    }).filter((r) => r.id);
    state.thanks = (Array.isArray(raw.thanks) ? raw.thanks : []).map((t) => {
      const s = t as Partial<OgonekThanks>;
      return {
        id: String(s.id || ''),
        toUserId: Number(s.toUserId) || 0,
        toName: str(s.toName, 80),
        text: str(s.text, OGONEK_THANKS_MAX),
        createdAt: str(s.createdAt, 40) || new Date().toISOString()
      };
    }).filter((t) => t.id);
    state.letters = (Array.isArray(raw.letters) ? raw.letters : []).map((l) => {
      const s = l as Partial<OgonekLetter>;
      return {
        id: String(s.id || ''),
        userId: Number(s.userId) || 0,
        name: str(s.name, 80),
        text: str(s.text, OGONEK_LETTER_MAX),
        createdAt: str(s.createdAt, 40) || new Date().toISOString(),
        deliverAt: str(s.deliverAt, 40) || OGONEK_LETTER_DELIVERY_AT,
        delivered: Boolean(s.delivered)
      };
    }).filter((l) => l.id);
    state.feed = (Array.isArray(raw.feed) ? raw.feed : []).map((f) => {
      const s = f as Partial<OgonekFeedItem>;
      return {
        id: String(s.id || ''),
        kind: String(s.kind || 'window') as OgonekFeedKind,
        name: s.name === null ? null : str(s.name, 80),
        department: s.department === null ? null : str(s.department, 80),
        text: str(s.text, 200),
        at: str(s.at, 40) || new Date().toISOString()
      };
    }).filter((f) => f.id).slice(-OGONEK_FEED_LIMIT);
    return state;
  } catch {
    return emptyState();
  }
}

export async function readOgonekState(): Promise<OgonekState> {
  return readState();
}

/** Мутация под очередью — без гонок read-modify-write на одном файле. */
export async function mutateOgonek<T>(fn: (state: OgonekState) => T | Promise<T>): Promise<T> {
  return enqueue(async () => {
    const state = await readState();
    const result = await fn(state);
    await writeJsonAtomic(DATA_FILE, state);
    return result;
  });
}

export function findOrCreateOgonekPlayer(
  state: OgonekState,
  userId: number,
  name: string,
  department: string
): OgonekPlayer {
  let player = state.players.find((p) => p.userId === userId);
  if (!player) {
    player = emptyOgonekPlayer(userId, name, department);
    state.players.push(player);
  }
  if (name) player.name = name;
  if (department) player.department = department;
  player.updatedAt = new Date().toISOString();
  return player;
}

export function ogonekId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Событие в живую ленту. У «спасибо» имя не пишем вообще: открытка анонимна
 * (спека, раздел 4b, пункт 1) — анонимность должна держаться хранилищем,
 * а не тем, что клиент не станет показывать имя.
 */
export function pushOgonekFeed(
  state: OgonekState,
  kind: OgonekFeedKind,
  text: string,
  who: { name: string; department: string } | null
): void {
  state.feed.push({
    id: ogonekId('f'),
    kind,
    name: who ? who.name : null,
    department: who ? who.department || null : null,
    text: str(text, 200),
    at: new Date().toISOString()
  });
  if (state.feed.length > OGONEK_FEED_LIMIT) {
    state.feed.splice(0, state.feed.length - OGONEK_FEED_LIMIT);
  }
}
