import type { VacationRequest } from '~/composables/useVacations';
import {
  POST_VACATION_MEMO_DOCK_WORKING_DAYS,
  POST_VACATION_MEMO_MIN_DAYS,
  POST_VACATION_MEMO_WINDOW_WORKING_DAYS
} from '~/data/postVacationMemoSlides';
import { addWorkingDaysIso, todayIso } from '~/utils/vacationCalendar';

export const inclusiveDays = (start: string, end: string): number => {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
};

const STORAGE_V1 = 'vbi-post-vacation-memo-v1';
export const POST_VACATION_MEMO_STORAGE_KEY = 'vbi-post-vacation-memo-v2';

export type PostVacationMemoPhase = 'docked' | 'done';

export type PostVacationMemoRecord = {
  requestId: number;
  phase: PostVacationMemoPhase;
  thanksAt: string;
  dockExpires: string;
};

type StoreV2 = Record<string, Record<string, PostVacationMemoRecord>>;
type StoreV1 = Record<string, number[]>;

const readJson = <T>(key: string, fallback: T): T => {
  if (!import.meta.client) return fallback;
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '');
    return raw && typeof raw === 'object' ? (raw as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeV2 = (store: StoreV2) => {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(POST_VACATION_MEMO_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
};

const migrateV1 = (userId: number, store: StoreV2): StoreV2 => {
  const v1 = readJson<StoreV1>(STORAGE_V1, {});
  const ids = v1[String(userId)] ?? [];
  if (!ids.length) return store;
  const bucket = { ...(store[String(userId)] ?? {}) };
  for (const id of ids) {
    if (bucket[String(id)]) continue;
    bucket[String(id)] = {
      requestId: id,
      phase: 'done',
      thanksAt: todayIso(),
      dockExpires: todayIso()
    };
  }
  store[String(userId)] = bucket;
  writeV2(store);
  return store;
};

export const readMemoRecord = (userId: number, requestId: number): PostVacationMemoRecord | null => {
  if (!import.meta.client) return null;
  let store = readJson<StoreV2>(POST_VACATION_MEMO_STORAGE_KEY, {});
  store = migrateV1(userId, store);
  const row = store[String(userId)]?.[String(requestId)];
  if (!row) return null;
  if (row.phase === 'docked' && todayIso() > row.dockExpires) {
    const done = { ...row, phase: 'done' as const };
    writeMemoRecord(userId, done);
    return done;
  }
  return row;
};

export const writeMemoRecord = (userId: number, record: PostVacationMemoRecord) => {
  if (!import.meta.client) return;
  const store = readJson<StoreV2>(POST_VACATION_MEMO_STORAGE_KEY, {});
  const uid = String(userId);
  store[uid] = { ...(store[uid] ?? {}), [String(record.requestId)]: record };
  writeV2(store);
};

export const buildDockedRecord = (requestId: number, fromIso = todayIso()): PostVacationMemoRecord => ({
  requestId,
  phase: 'docked',
  thanksAt: fromIso,
  dockExpires: addWorkingDaysIso(fromIso, POST_VACATION_MEMO_DOCK_WORKING_DAYS)
});

export const listKnownMemoRequestIds = (userId: number): Set<number> => {
  if (!import.meta.client) return new Set();
  let store = readJson<StoreV2>(POST_VACATION_MEMO_STORAGE_KEY, {});
  store = migrateV1(userId, store);
  const bucket = store[String(userId)] ?? {};
  return new Set(Object.values(bucket).map((row) => row.requestId));
};

/** Заявка уже показывалась (чип / прочитана до конца) — welcome снова не нужен. */
export const isMemoRequestKnown = (userId: number, requestId: number): boolean => {
  if (!import.meta.client) return false;
  return readMemoRecord(userId, requestId) != null;
};

export const findDockedMemoRequestId = (userId: number): number | null => {
  if (!import.meta.client) return null;
  let store = readJson<StoreV2>(POST_VACATION_MEMO_STORAGE_KEY, {});
  store = migrateV1(userId, store);
  const today = todayIso();
  for (const row of Object.values(store[String(userId)] ?? {})) {
    if (row.phase === 'docked' && today <= row.dockExpires) return row.requestId;
  }
  return null;
};

export function findPostVacationMemoRequest(
  requests: VacationRequest[],
  employeeName: string,
  today: string,
  knownIds: ReadonlySet<number>
): VacationRequest | null {
  const name = employeeName.trim();
  if (!name) return null;

  const eligible = requests.filter((row) => {
    if (row.status !== 'approved') return false;
    if (row.employee.trim() !== name) return false;
    if (knownIds.has(row.id)) return false;
    if (inclusiveDays(row.start, row.end) < POST_VACATION_MEMO_MIN_DAYS) return false;
    if (today <= row.end) return false;
    const lastShow = addWorkingDaysIso(row.end, POST_VACATION_MEMO_WINDOW_WORKING_DAYS);
    return today <= lastShow;
  });

  if (!eligible.length) return null;
  return [...eligible].sort((a, b) => b.end.localeCompare(a.end) || b.id - a.id)[0] ?? null;
}
