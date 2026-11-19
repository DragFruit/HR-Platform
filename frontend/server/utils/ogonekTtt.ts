import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createMutationQueue, writeJsonAtomic } from './atomicJson';
import { mutateOgonek, pushOgonekFeed, type OgonekTttMatch } from './ogonekStore';
import {
  tttApplyMove,
  tttEmptyState,
  type TttMove,
  type TttState,
  type TttSymbol
} from '../../app/events/ogonek/ttt/engine';

/**
 * Крестики-нолики «Огонька» (окно 10): онлайн-комнаты между сотрудниками.
 * Механика — как в игре ultimate-tic-tac-toe.ru (RoomService.php):
 * комната по коду из 6 символов ждёт соперника 30 минут, на ход 30 секунд
 * (просрочил — проиграл), сдача, ничья по согласию, выход из партии —
 * поражение. Кто играет — знает сессия платформы, токены не нужны.
 *
 * Комнаты лежат в server/data/ogonek-ttt.json. Итог каждой партии пишется
 * в ogonek.json → ttt.matches, оттуда таблица лидеров адвента.
 */

const DATA_FILE = join(process.cwd(), 'server/data/ogonek-ttt.json');
const enqueue = createMutationQueue();

export const TTT_TURN_SECONDS = 30;
const WAIT_MINUTES = 30;
/** Законченные комнаты храним сутки — чтобы оба игрока увидели итог. */
const KEEP_FINISHED_MS = 24 * 3600 * 1000;

export type TttSlot = 'p1' | 'p2';
export type TttPlayer = { uid: number; name: string; department: string };

export type TttRoom = {
  id: number;
  code: string;
  status: 'waiting' | 'playing' | 'finished' | 'abandoned';
  p1: TttPlayer;
  p2: TttPlayer | null;
  p1Symbol: TttSymbol;
  state: TttState;
  /** Чей ход (слот); null до начала партии. */
  turn: TttSlot | null;
  deadline: string | null;
  drawOfferedBy: TttSlot | null;
  winner: TttSlot | 'draw' | null;
  /** Номер последнего изменения — клиент опрашивает «что нового после N». */
  seq: number;
  lastMove: TttMove | null;
  createdAt: string;
  expiresAt: string | null;
  finishedAt: string | null;
};

type Store = { nextId: number; rooms: TttRoom[] };

async function readStore(): Promise<Store> {
  try {
    const raw = JSON.parse(await readFile(DATA_FILE, 'utf8')) as Partial<Store>;
    return { nextId: Number(raw.nextId) || 1, rooms: Array.isArray(raw.rooms) ? raw.rooms : [] };
  } catch {
    return { nextId: 1, rooms: [] };
  }
}

async function mutate<T>(fn: (s: Store) => T | Promise<T>): Promise<T> {
  return enqueue(async () => {
    const s = await readStore();
    const out = await fn(s);
    const now = Date.now();
    s.rooms = s.rooms.filter((r) => !r.finishedAt || now - Date.parse(r.finishedAt) < KEEP_FINISHED_MS);
    await writeJsonAtomic(DATA_FILE, s);
    return out;
  });
}

const fail = (statusMessage: string, statusCode = 400): never => {
  throw createError({ statusCode, statusMessage });
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(rooms: TttRoom[]): string {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    if (!rooms.some((r) => r.code === code && (r.status === 'waiting' || r.status === 'playing'))) return code;
  }
}

export const tttSlotOf = (room: TttRoom, uid: number): TttSlot | null =>
  room.p1.uid === uid ? 'p1' : room.p2?.uid === uid ? 'p2' : null;

const symbolOf = (room: TttRoom, slot: TttSlot): TttSymbol =>
  slot === 'p1' ? room.p1Symbol : room.p1Symbol === 'X' ? 'O' : 'X';

/** Партия закончилась: фиксируем и пишем результат в таблицу лидеров адвента. */
async function finish(room: TttRoom, winner: TttSlot | 'draw', how: string) {
  room.status = 'finished';
  room.winner = winner;
  room.turn = null;
  room.deadline = null;
  room.drawOfferedBy = null;
  room.finishedAt = new Date().toISOString();
  room.seq++;
  if (!room.p2) return;
  const p2 = room.p2;
  await mutateOgonek((s) => {
    const ttt = s.ttt ?? { since: '', matches: [] };
    if (ttt.matches.some((m) => m.id === room.id)) return;
    const match: OgonekTttMatch = {
      id: room.id,
      at: room.finishedAt!,
      winner: winner === 'p1' ? 'player1' : winner === 'p2' ? 'player2' : 'draw',
      p1: { uid: String(room.p1.uid), name: room.p1.name },
      p2: { uid: String(p2.uid), name: p2.name }
    };
    ttt.matches.push(match);
    s.ttt = ttt;
    if (winner !== 'draw') {
      const w = winner === 'p1' ? room.p1 : p2;
      const l = winner === 'p1' ? p2 : room.p1;
      // Имя соперника без падежа: «победа в крестиках-ноликах · соперник: Мария Тестова»
      pushOgonekFeed(s, 'ttt', `победа в крестиках-ноликах · соперник: ${l.name}${how}`, { name: w.name, department: w.department });
    }
  });
}

/** Ход просрочен — проиграл тот, чей ход. Проверяется при каждом обращении. */
async function checkTimeout(room: TttRoom): Promise<void> {
  if (room.status === 'playing' && room.deadline && Date.parse(room.deadline) <= Date.now() && room.turn) {
    await finish(room, room.turn === 'p1' ? 'p2' : 'p1', ' (время хода вышло)');
  }
  if (room.status === 'waiting' && room.expiresAt && Date.parse(room.expiresAt) <= Date.now()) {
    room.status = 'abandoned';
    room.finishedAt = new Date().toISOString();
    room.seq++;
  }
}

/** Комната глазами игрока: его слот и символ, без чужих служебных полей. */
export function tttView(room: TttRoom, uid: number) {
  const slot = tttSlotOf(room, uid);
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    you: slot,
    symbol: slot ? symbolOf(room, slot) : null,
    p1: { name: room.p1.name, department: room.p1.department, symbol: room.p1Symbol },
    p2: room.p2 ? { name: room.p2.name, department: room.p2.department, symbol: symbolOf(room, 'p2') } : null,
    state: room.state,
    turn: room.turn,
    deadline: room.deadline,
    drawOfferedBy: room.drawOfferedBy,
    winner: room.winner,
    seq: room.seq,
    lastMove: room.lastMove,
    expiresAt: room.expiresAt
  };
}
export type TttRoomView = ReturnType<typeof tttView>;

/** Активная комната игрока (ждёт соперника или идёт партия). */
export async function tttActiveRoom(uid: number): Promise<TttRoom | null> {
  return mutate(async (s) => {
    for (const r of s.rooms) await checkTimeout(r);
    return s.rooms.find((r) => (r.status === 'waiting' || r.status === 'playing') && tttSlotOf(r, uid)) ?? null;
  });
}

/**
 * Кто ждёт соперника — только чтение, без записи файла: это опрашивает
 * лента адвента раз в 5 секунд у каждого. Просроченные комнаты отсекаем
 * по времени, а закроются они при следующей записи.
 */
export async function tttWaitingRead(uid: number) {
  const s = await readStore();
  const now = Date.now();
  return s.rooms
    .filter((r) => r.status === 'waiting' && r.p1.uid !== uid && (!r.expiresAt || Date.parse(r.expiresAt) > now))
    .map((r) => ({ code: r.code, name: r.p1.name, department: r.p1.department, createdAt: r.createdAt }));
}

/** Открытые комнаты коллег — можно войти одним кликом, без кода. */
export async function tttLobby(uid: number) {
  return mutate(async (s) => {
    for (const r of s.rooms) await checkTimeout(r);
    return s.rooms
      .filter((r) => r.status === 'waiting' && r.p1.uid !== uid)
      .map((r) => ({ code: r.code, name: r.p1.name, department: r.p1.department, createdAt: r.createdAt }));
  });
}

export async function tttCreate(me: TttPlayer): Promise<TttRoom> {
  return mutate(async (s) => {
    for (const r of s.rooms) await checkTimeout(r);
    const playing = s.rooms.find((r) => r.status === 'playing' && tttSlotOf(r, me.uid));
    if (playing) fail('У вас уже идёт партия', 409);
    // Своя прежняя пустая комната больше не нужна
    for (const r of s.rooms) {
      if (r.status === 'waiting' && r.p1.uid === me.uid) {
        r.status = 'abandoned';
        r.finishedAt = new Date().toISOString();
        r.seq++;
      }
    }
    const now = new Date();
    const room: TttRoom = {
      id: s.nextId++,
      code: newCode(s.rooms),
      status: 'waiting',
      p1: me,
      p2: null,
      p1Symbol: 'X',
      state: tttEmptyState('X'),
      turn: null,
      deadline: null,
      drawOfferedBy: null,
      winner: null,
      seq: 1,
      lastMove: null,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + WAIT_MINUTES * 60_000).toISOString(),
      finishedAt: null
    };
    s.rooms.push(room);
    // Все в адвенте видят вызов в ленте «Прямо сейчас»
    await mutateOgonek((st) => {
      pushOgonekFeed(st, 'ttt', 'ищет соперника в крестики-нолики', { name: me.name, department: me.department });
    });
    return room;
  });
}

export async function tttJoin(me: TttPlayer, code: string): Promise<TttRoom> {
  return mutate(async (s) => {
    for (const r of s.rooms) await checkTimeout(r);
    const room = s.rooms.find((r) => r.code === code.trim().toUpperCase() && (r.status === 'waiting' || r.status === 'playing'));
    if (!room) return fail('Комната не найдена или уже закрыта', 404);
    if (tttSlotOf(room, me.uid)) return room; // уже внутри
    if (room.status !== 'waiting') fail('В комнате уже двое', 409);
    if (s.rooms.some((r) => r.status === 'playing' && tttSlotOf(r, me.uid))) fail('У вас уже идёт партия', 409);
    // Своя пустая комната закрывается: играем в чужой
    for (const r of s.rooms) {
      if (r.status === 'waiting' && r.p1.uid === me.uid) {
        r.status = 'abandoned';
        r.finishedAt = new Date().toISOString();
        r.seq++;
      }
    }
    // Кто крестики — жребий, крестики ходят первыми
    room.p1Symbol = Math.random() < 0.5 ? 'X' : 'O';
    room.p2 = me;
    room.status = 'playing';
    room.state = tttEmptyState('X');
    room.turn = room.p1Symbol === 'X' ? 'p1' : 'p2';
    room.deadline = new Date(Date.now() + TTT_TURN_SECONDS * 1000).toISOString();
    room.expiresAt = null;
    room.seq++;
    return room;
  });
}

/** Любое действие внутри комнаты: под очередью, с проверкой таймаута. */
async function inRoom(uid: number, id: number, fn: (room: TttRoom, slot: TttSlot) => Promise<void> | void): Promise<TttRoom> {
  return mutate(async (s) => {
    const room = s.rooms.find((r) => r.id === id);
    if (!room) return fail('Комната не найдена', 404);
    const slot = tttSlotOf(room, uid);
    if (!slot) return fail('Это не ваша партия', 403);
    await checkTimeout(room);
    await fn(room, slot);
    return room;
  });
}

export const tttGet = (uid: number, id: number) => inRoom(uid, id, () => {});

export const tttMove = (uid: number, id: number, m: TttMove) =>
  inRoom(uid, id, async (room, slot) => {
    if (room.status !== 'playing') fail('Партия уже закончилась', 409);
    if (room.turn !== slot) fail('Сейчас ход соперника', 409);
    try {
      room.state = tttApplyMove(room.state, m);
    } catch {
      fail('Так ходить нельзя', 422);
    }
    room.lastMove = m;
    room.drawOfferedBy = null;
    room.seq++;
    const r = room.state.bigResult;
    if (r !== null) {
      await finish(room, r === 'draw' ? 'draw' : r === room.p1Symbol ? 'p1' : 'p2', '');
      return;
    }
    room.turn = slot === 'p1' ? 'p2' : 'p1';
    room.deadline = new Date(Date.now() + TTT_TURN_SECONDS * 1000).toISOString();
  });

export const tttSurrender = (uid: number, id: number) =>
  inRoom(uid, id, async (room, slot) => {
    if (room.status === 'waiting') {
      room.status = 'abandoned';
      room.finishedAt = new Date().toISOString();
      room.seq++;
      return;
    }
    if (room.status !== 'playing') return;
    await finish(room, slot === 'p1' ? 'p2' : 'p1', ' (соперник сдался)');
  });

export const tttDraw = (uid: number, id: number, action: 'offer' | 'accept' | 'decline') =>
  inRoom(uid, id, async (room, slot) => {
    if (room.status !== 'playing') fail('Партия уже закончилась', 409);
    if (action === 'offer') {
      room.drawOfferedBy = slot;
    } else if (room.drawOfferedBy && room.drawOfferedBy !== slot) {
      if (action === 'accept') {
        await finish(room, 'draw', '');
        return;
      }
      room.drawOfferedBy = null;
    }
    room.seq++;
  });

export type OgonekTttRow = { uid: string; name: string; wins: number; draws: number; losses: number; games: number };

/** Таблица лидеров: больше побед выше, при равенстве — меньше поражений. */
export function ogonekTttLeaders(matches: OgonekTttMatch[], nameOf: (uid: string) => string | undefined): OgonekTttRow[] {
  const by = new Map<string, OgonekTttRow>();
  const row = (p: { uid: string; name: string }) => {
    let r = by.get(p.uid);
    if (!r) {
      r = { uid: p.uid, name: nameOf(p.uid) || p.name || 'Игрок', wins: 0, draws: 0, losses: 0, games: 0 };
      by.set(p.uid, r);
    }
    return r;
  };
  for (const m of matches) {
    const a = row(m.p1);
    const b = row(m.p2);
    a.games++;
    b.games++;
    if (m.winner === 'draw') { a.draws++; b.draws++; }
    else if (m.winner === 'player1') { a.wins++; b.losses++; }
    else { b.wins++; a.losses++; }
  }
  return [...by.values()].sort((x, y) => y.wins - x.wins || x.losses - y.losses || y.draws - x.draws || x.name.localeCompare(y.name, 'ru'));
}
