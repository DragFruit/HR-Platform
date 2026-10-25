import { openingBalanceForYear } from '../../app/utils/vacationBalance';
import type { VacationRequest } from '../../app/composables/useVacations';
import type { ServerEmployee } from './employeesStore';
import type { VacationStoreState, VacationYearRolloverRecord } from './vacationsStore';
import type { VacationWriteContext } from '../vacations/types';

export type YearRolloverEmployeeUpdate = {
  id: number;
  name: string;
  fromOpening: number | null;
  toOpening: number;
};

export type YearRolloverResult = {
  employees: ServerEmployee[];
  vacations: VacationStoreState;
  updates: YearRolloverEmployeeUpdate[];
  skipped: string[];
};

/** Все заявки с годом бакета ≤ throughYear (для расчёта остатка на 31.12). */
export function requestsThroughYear(
  state: VacationStoreState,
  throughYear: number
): VacationRequest[] {
  return Object.entries(state.requestsByYear)
    .filter(([yearKey]) => {
      const y = Number(yearKey);
      return !Number.isNaN(y) && y <= throughYear;
    })
    .flatMap(([, list]) => list);
}

/**
 * Остаток на конец учётного года (31.12) — то, что переносим на 01.01 следующего года.
 * Та же функция, что считает в UI остаток для брони на следующий год (`openingBalanceForYear`).
 */
export function closingBalanceOnYearEnd(
  emp: Pick<ServerEmployee, 'name' | 'hired_at' | 'vacation_opening_balance'>,
  fromYear: number,
  requests: VacationRequest[]
): number | null {
  const hire = emp.hired_at?.trim();
  if (!hire) return null;
  return (
    openingBalanceForYear(emp.name, hire, fromYear + 1, requests, fromYear, emp.vacation_opening_balance) ?? null
  );
}

/**
 * Переход учётного года: остаток на 31.12.fromYear → vacation_opening_balance на 01.01.toYear.
 * primaryYear в vacations обновляется на toYear. Чистая функция, ничего не пишет.
 */
export function applyVacationYearRollover(
  employees: ServerEmployee[],
  vacations: VacationStoreState,
  fromYear: number,
  toYear: number
): YearRolloverResult {
  if (toYear !== fromYear + 1) {
    throw new Error(`Ожидается toYear = fromYear + 1 (получено ${fromYear} → ${toYear})`);
  }

  const requests = requestsThroughYear(vacations, fromYear);
  const updates: YearRolloverEmployeeUpdate[] = [];
  const skipped: string[] = [];

  const nextEmployees = employees.map((emp) => {
    const closing = closingBalanceOnYearEnd(emp, fromYear, requests);
    if (closing === null) {
      skipped.push(emp.name);
      return emp;
    }

    // closing уже округлён вниз до 0,1 в calcAvailableOnDate; здесь только убрать хвост плавающей точки.
    const rounded = Math.round(closing * 10) / 10;
    updates.push({
      id: emp.id,
      name: emp.name,
      fromOpening: emp.vacation_opening_balance ?? null,
      toOpening: rounded
    });

    return {
      ...emp,
      vacation_opening_balance: rounded
    };
  });

  const nextVacations: VacationStoreState = {
    ...vacations,
    primaryYear: toYear,
    requestsByYear: {
      ...vacations.requestsByYear,
      [String(toYear)]: vacations.requestsByYear[String(toYear)] ?? []
    }
  };

  return {
    employees: nextEmployees,
    vacations: nextVacations,
    updates,
    skipped
  };
}

/* ------------------------------------------------------------------ */
/* Атомарный переход года (автоматически 1 января и из админки)        */
/* ------------------------------------------------------------------ */

export const VACATION_ROLLOVER_TIME_ZONE = 'Europe/Moscow';

/** Календарный год по Москве на момент now. */
export function moscowYear(now: Date = new Date()): number {
  const year = new Intl.DateTimeFormat('en-US', { timeZone: VACATION_ROLLOVER_TIME_ZONE, year: 'numeric' }).format(now);
  return Number(year);
}

/** Пора ли менять учётный год: год по Москве уже больше primaryYear. */
export function isVacationRolloverDue(primaryYear: number, now: Date = new Date()): boolean {
  return moscowYear(now) > primaryYear;
}

/** Мс до ближайшей полуночи по Москве (+30 с запаса). МСК без перехода на летнее время, UTC+3. */
export function msUntilNextMoscowMidnight(now: Date = new Date()): number {
  const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
  const msk = new Date(now.getTime() + MSK_OFFSET_MS);
  const nextMidnightUtc =
    Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() + 1, 0, 0, 30) - MSK_OFFSET_MS;
  return nextMidnightUtc - now.getTime();
}

export type VacationRolloverDeps = {
  /** Атомарная правка отпусков (mutateVacations: очередь JSON / транзакция под advisory lock в Postgres). */
  mutate: (
    mutator: (state: VacationStoreState) => VacationStoreState | Promise<VacationStoreState>,
    ctx?: VacationWriteContext
  ) => Promise<VacationStoreState>;
  readVacations: () => Promise<VacationStoreState>;
  readEmployees: () => Promise<ServerEmployee[]>;
  /** Записать остатки на 01.01 в карточки сотрудников (id → дни). */
  applyOpeningBalances: (balances: Record<string, number>, ctx: VacationWriteContext) => Promise<number>;
  now?: () => Date;
};

export type VacationRolloverOutcome = {
  changed: boolean;
  fromYear: number;
  toYear: number;
  primaryYear: number;
  updated: number;
  skipped: string[];
  updates: YearRolloverEmployeeUpdate[];
  employeesApplied: boolean;
};

/**
 * Переход учётного года до toYear (по шагу за год) внутри одной атомарной правки отпусков.
 * Идемпотентно: если primaryYear ≥ toYear — ничего не меняет. Новые заявки, созданные
 * параллельно, не теряются: читаем и пишем состояние под тем же замком, что и POST заявок.
 *
 * Остатки сотрудников живут в другом хранилище, поэтому сначала в состоянии отпусков фиксируется
 * снимок `yearRollover.openingBalances`, затем он применяется к карточкам (повторное применение
 * безопасно — просто «поставить значение»). Если запись карточек упала, её доделает следующий запуск.
 */
export async function runVacationYearRollover(
  deps: VacationRolloverDeps,
  toYear: number,
  ctx: VacationWriteContext = { reason: 'vacation-rollover' }
): Promise<VacationRolloverOutcome> {
  const now = deps.now?.() ?? new Date();
  let outcome: VacationRolloverOutcome | null = null;

  await deps.mutate(async (state) => {
    const fromYear = state.primaryYear;
    if (fromYear >= toYear) {
      outcome = {
        changed: false,
        fromYear,
        toYear,
        primaryYear: fromYear,
        updated: 0,
        skipped: [],
        updates: [],
        employeesApplied: false
      };
      return state;
    }

    // Сначала доделать незаписанный снимок прошлого перехода, иначе посчитаем от старых остатков.
    let employees = withPendingOpeningBalances(await deps.readEmployees(), state.yearRollover);
    let vacations = state;
    let updates: YearRolloverEmployeeUpdate[] = [];
    let skipped: string[] = [];
    for (let year = fromYear; year < toYear; year += 1) {
      const step = applyVacationYearRollover(employees, vacations, year, year + 1);
      employees = step.employees;
      vacations = step.vacations;
      // Для отчёта: исходный остаток до первого шага, итог после последнего.
      updates = mergeUpdates(updates, step.updates);
      skipped = step.skipped;
    }

    const openingBalances: Record<string, number> = {};
    for (const u of updates) openingBalances[String(u.id)] = u.toOpening;
    const record: VacationYearRolloverRecord = {
      fromYear,
      toYear,
      at: now.toISOString(),
      reason: ctx.reason ?? 'vacation-rollover',
      openingBalances,
      employeesAppliedAt: null
    };
    outcome = {
      changed: true,
      fromYear,
      toYear,
      primaryYear: toYear,
      updated: updates.length,
      skipped,
      updates,
      employeesApplied: false
    };
    return { ...vacations, yearRollover: record };
  }, ctx);

  const result = outcome as unknown as VacationRolloverOutcome;
  try {
    result.employeesApplied = await applyPendingRolloverBalances(deps, ctx);
  } catch (err) {
    // Год уже сменён и снимок сохранён: остатки допишет следующий запуск (старт процесса / полночь).
    console.error('[vacation-rollover] остатки в карточки сотрудников не записаны, повтор позже', err);
    result.employeesApplied = false;
  }
  return result;
}

/** Поставить остатки из снимка, если он ещё не записан в карточки. */
function withPendingOpeningBalances(
  employees: ServerEmployee[],
  record: VacationYearRolloverRecord | undefined
): ServerEmployee[] {
  if (!record || record.employeesAppliedAt) return employees;
  return employees.map((emp) => {
    const value = record.openingBalances[String(emp.id)];
    return value === undefined ? emp : { ...emp, vacation_opening_balance: value };
  });
}

function mergeUpdates(
  prev: YearRolloverEmployeeUpdate[],
  next: YearRolloverEmployeeUpdate[]
): YearRolloverEmployeeUpdate[] {
  const first = new Map(prev.map((u) => [u.id, u.fromOpening]));
  return next.map((u) => (first.has(u.id) ? { ...u, fromOpening: first.get(u.id) ?? null } : u));
}

/**
 * Дописать остатки последнего перехода в карточки сотрудников, если ещё не записаны.
 * true — снимок применён (сейчас или раньше).
 */
export async function applyPendingRolloverBalances(
  deps: VacationRolloverDeps,
  ctx: VacationWriteContext = { reason: 'vacation-rollover' }
): Promise<boolean> {
  const state = await deps.readVacations();
  const record = state.yearRollover;
  if (!record) return false;
  if (record.employeesAppliedAt) return true;

  await deps.applyOpeningBalances(record.openingBalances, ctx);
  const appliedAt = (deps.now?.() ?? new Date()).toISOString();
  await deps.mutate((current) => {
    const r = current.yearRollover;
    if (!r || r.toYear !== record.toYear || r.employeesAppliedAt) return current;
    return { ...current, yearRollover: { ...r, employeesAppliedAt: appliedAt } };
  }, ctx);
  return true;
}

/**
 * Проверка по расписанию / при старте: если по Москве наступил год больше primaryYear —
 * переход года; плюс доделать незаписанные остатки. Возвращает null, если делать нечего.
 */
export async function runScheduledVacationRollover(
  deps: VacationRolloverDeps
): Promise<VacationRolloverOutcome | null> {
  const now = deps.now?.() ?? new Date();
  const state = await deps.readVacations();
  if (!isVacationRolloverDue(state.primaryYear, now)) {
    if (state.yearRollover && !state.yearRollover.employeesAppliedAt) {
      await applyPendingRolloverBalances(deps, { reason: 'vacation-rollover:auto' });
    }
    return null;
  }
  return runVacationYearRollover(deps, moscowYear(now), { reason: 'vacation-rollover:auto' });
}
