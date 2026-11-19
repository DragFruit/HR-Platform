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
import { OGONEK_PIXEL_RE } from '../../app/events/ogonek/palette';
import { isOgonekFlakeQuarter } from '../../app/events/ogonek/snowflake';

const DATA_FILE = join(process.cwd(), 'server/data/ogonek.json');
const enqueue = createMutationQueue();

/** Сетка игрушки. Размер жёсткий: по нему нарисован редактор. */
export const OGONEK_TOY_SIZE = 16;
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
  /** Окна, в которых действие выполнено: по ним горят огоньки гирлянды. */
  done: number[];
  /** Вилка воткнута — декор платформы горит. */
  plugged: boolean;
  /** Колпак на аватарке (окно 3). */
  hat: boolean;
  /** Песня года (окно 1) — до вечера не показывается никому. */
  song?: string;
  /** Записался на каток (окно 5). */
  skating?: boolean;
  /** Формат Тайного Санты (окно 2): классический или «Белый слон». */
  santa?: OgonekSantaFormat;
  /** Вишлист для классического Санты: его увидит тот, кто дарит. */
  santaWish?: string;
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
  /** Сколько писем было в коробке, когда её показали. Пришли новые — покажем снова. */
  mailboxSeenCount: number;
  /** Какие письма уже вскрыты. */
  thanksRead: string[];
  updatedAt: string;
};

export type OgonekSantaFormat = 'classic' | 'elephant';

/**
 * Жеребьёвка Тайного Санты. Делается сама после закрытия регистрации
 * (см. ensureOgonekSantaDraw). `sig` — состав участников на момент
 * жеребьёвки: если он поменялся (бывает только на стендах в отладке),
 * жеребьёвка пересчитывается.
 */
export type OgonekSantaDraw = {
  at: string;
  sig: string;
  /** Классика: кто кому дарит, userId → userId. */
  pairs: Record<string, number>;
  /** Белый слон: порядок ходов на вечере. */
  order: number[];
};

/** Онлайн-партия крестиков-ноликов между двумя сотрудниками (с сайта игры). */
export type OgonekTttMatch = {
  id: number;
  at: string;
  winner: 'player1' | 'player2' | 'draw';
  p1: { uid: string; name: string };
  p2: { uid: string; name: string };
};

export type OgonekState = {
  players: OgonekPlayer[];
  toys: OgonekToy[];
  snowflakes: OgonekSnowflake[];
  recipes: (OgonekRecipe & { voters: number[] })[];
  thanks: OgonekThanks[];
  letters: OgonekLetter[];
  feed: OgonekFeedItem[];
  santaDraw?: OgonekSantaDraw;
  /** Крестики-нолики: партии и метка, с какого времени забирать новые. */
  ttt?: { since: string; matches: OgonekTttMatch[] };
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
    done: [],
    plugged: false,
    hat: false,
    thanksSent: 0,
    mailboxSeenCount: 0,
    thanksRead: [],
    updatedAt: new Date().toISOString()
  };
}

const str = (v: unknown, max: number) => String(v ?? '').slice(0, max);

/** Список номеров окон без дублей и мусора, по возрастанию. */
const dayList = (v: unknown): number[] =>
  Array.isArray(v)
    ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 19))].sort((a, b) => a - b)
    : [];
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
    if (!OGONEK_PIXEL_RE.test(s)) return null;
    out.push(s);
  }
  // Пустая сетка — не игрушка.
  if (!out.some((r) => /[^.]/.test(r))) return null;
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
  // Старый формат (полный лист 15×15) после перехода на четверть не читаем:
  // настоящих снежинок в нём не было, только тестовые.
  if (!s.id || !isOgonekFlakeQuarter(s.pixels)) return null;
  return {
    id: String(s.id),
    userId: Number(s.userId) || 0,
    name: str(s.name, 80) || 'Сотрудник',
    pixels: [...s.pixels],
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
        opened: dayList(src.opened),
        done: dayList(src.done),
        plugged: Boolean(src.plugged),
        hat: Boolean(src.hat),
        song: src.song ? str(src.song, 160) : undefined,
        skating: src.skating ? true : undefined,
        // Старое «записался» без формата считаем классикой
        santa: src.santa === 'elephant' ? 'elephant' : src.santa ? 'classic' : undefined,
        santaWish: src.santaWish ? str(src.santaWish, 400) : undefined,
        dresscode: src.dresscode ? str(src.dresscode, 80) : undefined,
        toyId: src.toyId ? String(src.toyId) : undefined,
        snowflakeId: src.snowflakeId ? String(src.snowflakeId) : undefined,
        letterId: src.letterId ? String(src.letterId) : undefined,
        recipeId: src.recipeId ? String(src.recipeId) : undefined,
        recipeVote: src.recipeVote ? String(src.recipeVote) : undefined,
        thanksSent: Math.max(0, Number(src.thanksSent) || 0),
        mailboxSeenCount: Math.max(0, Number(src.mailboxSeenCount) || 0),
        thanksRead: Array.isArray(src.thanksRead) ? src.thanksRead.map(String).slice(0, 500) : [],
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
    const t = raw.ttt as { since?: string; matches?: unknown[] } | undefined;
    if (t && typeof t === 'object') {
      state.ttt = {
        since: str(t.since, 40),
        matches: (Array.isArray(t.matches) ? t.matches : [])
          .map((m) => m as Partial<OgonekTttMatch>)
          .filter((m) => Number(m.id) > 0 && m.p1 && m.p2)
          .map((m) => ({
            id: Number(m.id),
            at: str(m.at, 40),
            winner: m.winner === 'player1' || m.winner === 'player2' ? m.winner : 'draw',
            p1: { uid: str(m.p1!.uid, 64), name: str(m.p1!.name, 80) },
            p2: { uid: str(m.p2!.uid, 64), name: str(m.p2!.name, 80) }
          }))
      };
    }
    const d = raw.santaDraw as Partial<OgonekSantaDraw> | undefined;
    if (d && typeof d === 'object' && d.at) {
      state.santaDraw = {
        at: str(d.at, 40),
        sig: str(d.sig, 4000),
        pairs: d.pairs && typeof d.pairs === 'object' ? Object.fromEntries(Object.entries(d.pairs).map(([k, v]) => [k, Number(v)])) : {},
        order: Array.isArray(d.order) ? d.order.map(Number).filter(Number.isFinite) : []
      };
    }
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

/** Окно выполнено: огонёк на гирлянде загорается. Повторно не дублируется. */
export function markOgonekDone(player: OgonekPlayer, dayId: number): void {
  if (!player.done.includes(dayId)) {
    player.done = [...player.done, dayId].sort((a, b) => a - b);
  }
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


function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function santaSig(state: OgonekState): string {
  const ids = (f: OgonekSantaFormat) => state.players.filter((p) => p.santa === f).map((p) => p.userId).sort((a, b) => a - b).join(',');
  return `c:${ids('classic')}|e:${ids('elephant')}`;
}

/**
 * Жеребьёвка после закрытия регистрации. Классика — один круг по
 * перемешанному списку: каждый дарит следующему, себе никто. «Белый слон» —
 * перемешанный порядок ходов. Вызывать только когда регистрация закрыта.
 * Возвращает актуальную жеребьёвку; пишет файл, только если её не было
 * или состав участников поменялся.
 */
export async function ensureOgonekSantaDraw(): Promise<OgonekSantaDraw> {
  const current = await readState();
  if (current.santaDraw && current.santaDraw.sig === santaSig(current)) return current.santaDraw;
  return mutateOgonek((state) => {
    const sig = santaSig(state);
    if (state.santaDraw && state.santaDraw.sig === sig) return state.santaDraw;
    const classic = shuffled(state.players.filter((p) => p.santa === 'classic').map((p) => p.userId));
    const pairs: Record<string, number> = {};
    if (classic.length >= 2) {
      classic.forEach((id, i) => { pairs[String(id)] = classic[(i + 1) % classic.length]!; });
    }
    const order = shuffled(state.players.filter((p) => p.santa === 'elephant').map((p) => p.userId));
    state.santaDraw = { at: new Date().toISOString(), sig, pairs, order };
    return state.santaDraw;
  });
}
