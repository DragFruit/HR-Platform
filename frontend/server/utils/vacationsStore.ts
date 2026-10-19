import type { VacationRequest } from '../../app/composables/useVacations';
import type { VacationReservation } from '../../app/utils/vacationReservations';
import {
  mergeQaTestVacationState,
  stripQaTestVacationRequests,
  stripQaTestVacationReservations,
  type QaDemoVacationSuppressed
} from '../../app/data/qaTestVacationSeed';
import { getDb, isDbEnabled } from '../db/client';
import { createPgVacationsRepo } from '../db/repositories/vacations';
import { createJsonVacationsRepo, VACATIONS_JSON_FILE } from '../vacations/jsonStore';
import type { VacationsRepo, VacationWriteContext } from '../vacations/types';

export type { VacationRequest, VacationReservation };

export type VacationStoreState = {
  primaryYear: number;
  requestsByYear: Record<string, VacationRequest[]>;
  nextRequestId: number;
  reservationsByYear: Record<string, VacationReservation[]>;
  nextReservationId: number;
  /** Удалённые демо-заявки/брони (localhost) — чтобы seed не возвращался после DELETE. */
  qaDemoSuppressed?: QaDemoVacationSuppressed;
  /** Лимит броней на месяц по группам Digital (groupId → max). */
  reservationMonthlyCapsByGroup?: Record<string, number>;
  /** Последний переход учётного года (снимок остатков на 01.01 для карточек сотрудников). */
  yearRollover?: VacationYearRolloverRecord;
};

export type VacationYearRolloverRecord = {
  fromYear: number;
  toYear: number;
  /** ISO-время перехода. */
  at: string;
  reason: string;
  /** id сотрудника → остаток на 01.01.toYear (vacation_opening_balance). */
  openingBalances: Record<string, number>;
  /** Когда остатки записаны в карточки; null — ещё нет (доделает следующий запуск). */
  employeesAppliedAt: string | null;
};

export const defaultVacationState = (): VacationStoreState => ({
  primaryYear: new Date().getFullYear(),
  requestsByYear: {},
  nextRequestId: 1,
  reservationsByYear: {},
  nextReservationId: 1
});

export function normalizeVacationStoreState(raw: Partial<VacationStoreState>): VacationStoreState {
  const base = defaultVacationState();
  return {
    primaryYear: typeof raw.primaryYear === 'number' ? raw.primaryYear : base.primaryYear,
    requestsByYear: raw.requestsByYear ?? base.requestsByYear,
    nextRequestId: typeof raw.nextRequestId === 'number' ? raw.nextRequestId : base.nextRequestId,
    reservationsByYear: raw.reservationsByYear ?? base.reservationsByYear,
    nextReservationId:
      typeof raw.nextReservationId === 'number' ? raw.nextReservationId : base.nextReservationId,
    qaDemoSuppressed: raw.qaDemoSuppressed,
    reservationMonthlyCapsByGroup: raw.reservationMonthlyCapsByGroup,
    ...(raw.yearRollover ? { yearRollover: raw.yearRollover } : {})
  };
}

function stripQaFromVacationState(state: VacationStoreState): VacationStoreState {
  const requestsByYear = Object.fromEntries(
    Object.entries(state.requestsByYear).map(([year, rows]) => [
      year,
      stripQaTestVacationRequests(rows)
    ])
  );
  const reservationsByYear = Object.fromEntries(
    Object.entries(state.reservationsByYear).map(([year, rows]) => [
      year,
      stripQaTestVacationReservations(rows)
    ])
  );
  return { ...state, requestsByYear, reservationsByYear };
}

/**
 * Хранилище отпусков (этап 4). DB_VACATIONS=1 и задан DATABASE_URL → Postgres (схема vacations),
 * иначе server/data/vacations.json. Флаг стоит только на стейдже; на проде DATABASE_URL есть,
 * но флага нет → JSON. Публичный API (readVacations / writeVacations / mutateVacations) не менялся.
 */
export function vacationsDbFlag(): boolean {
  return String(process.env.DB_VACATIONS || '').trim() === '1' && isDbEnabled();
}

let resolvePgReady!: (ok: boolean) => void;
const pgReady = new Promise<boolean>((resolve) => {
  resolvePgReady = resolve;
});

/** Вызывает плагин db-migrate: true — миграции и импорт прошли, можно работать с Postgres. */
export function setVacationsPgReady(ok: boolean) {
  resolvePgReady(ok);
}

let jsonRepo: VacationsRepo | null = null;
let pgRepo: VacationsRepo | null = null;
let warnedFallback = false;

export async function vacationsRepo(): Promise<VacationsRepo> {
  if (vacationsDbFlag()) {
    const ok = await pgReady;
    const db = ok ? getDb() : null;
    if (db) return (pgRepo ??= createPgVacationsRepo(db));
    if (!warnedFallback) {
      warnedFallback = true;
      console.error('[vacations] DB_VACATIONS=1, но Postgres недоступен — отпуска на JSON (бэкап может быть устаревшим)');
    }
  }
  return (jsonRepo ??= createJsonVacationsRepo(VACATIONS_JSON_FILE, defaultVacationState));
}

export async function getVacationsBackend(): Promise<'json' | 'postgres'> {
  return (await vacationsRepo()).backend;
}

/** Служебные поля, которые не отдаём клиенту (снимок остатков всех сотрудников при переходе года). */
export function withoutVacationServiceFields(state: VacationStoreState): VacationStoreState {
  if (!state.yearRollover) return state;
  const { yearRollover: _hidden, ...rest } = state;
  return rest;
}

/** Состояние для API и логики (без служебного снимка перехода года). */
export async function readVacations(): Promise<VacationStoreState> {
  return withoutVacationServiceFields(await readVacationsWithServiceFields());
}

/** Полное состояние, включая `yearRollover` (только для перехода года). */
export async function readVacationsWithServiceFields(): Promise<VacationStoreState> {
  const raw = await (await vacationsRepo()).readRaw();
  return mergeQaTestVacationState(normalizeVacationStoreState(raw));
}

/** Перезаписать состояние целиком (rollover). Возвращает то же состояние, что передали. */
export async function writeVacations(
  state: VacationStoreState,
  ctx?: VacationWriteContext
): Promise<VacationStoreState> {
  await (await vacationsRepo()).writeRaw(stripQaFromVacationState(state), ctx);
  return state;
}

/**
 * Mutator получает полное состояние (со служебным `yearRollover` — его надо сохранять, как остальные поля),
 * наружу возвращается состояние без служебных полей.
 * Сериализует все правки отпусков — без гонок при параллельных POST/PATCH.
 * JSON: очередь в процессе. Postgres: очередь + транзакция под advisory lock (см. repositories/vacations.ts).
 * Возвращает состояние, которое вернул mutator (с демо-записями QA, как и раньше).
 */
export async function mutateVacations(
  mutator: (state: VacationStoreState) => VacationStoreState | Promise<VacationStoreState>,
  ctx?: VacationWriteContext
): Promise<VacationStoreState> {
  let result!: VacationStoreState;
  await (await vacationsRepo()).mutateRaw(async (raw) => {
    const current = mergeQaTestVacationState(normalizeVacationStoreState(raw));
    result = await mutator(current);
    return stripQaFromVacationState(result);
  }, ctx);
  return withoutVacationServiceFields(result);
}

function normalizeEmployeeNameKey(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

/** Удалить заявки/брони сотрудника по ФИО (после срока хранения 1 год). */
export async function purgeVacationsForEmployeeName(
  employeeName: string,
  ctx: VacationWriteContext = { reason: 'access-revoked-purge' }
): Promise<number> {
  const key = normalizeEmployeeNameKey(employeeName);
  if (!key) return 0;

  let removed = 0;
  await mutateVacations((state) => {
    const next = { ...state, requestsByYear: { ...state.requestsByYear }, reservationsByYear: { ...state.reservationsByYear } };
    for (const [year, rows] of Object.entries(next.requestsByYear)) {
      const filtered = rows.filter((row) => normalizeEmployeeNameKey(row.employee) !== key);
      removed += rows.length - filtered.length;
      next.requestsByYear[year] = filtered;
    }
    for (const [year, rows] of Object.entries(next.reservationsByYear)) {
      const filtered = rows.filter((row) => normalizeEmployeeNameKey(row.employee) !== key);
      removed += rows.length - filtered.length;
      next.reservationsByYear[year] = filtered;
    }
    return next;
  }, ctx);
  return removed;
}
