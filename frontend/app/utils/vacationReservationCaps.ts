import type { VacationReservation } from '~/utils/vacationReservations';
import type { VacationRequest } from '~/composables/useVacations';
import { DEFAULT_RESERVATION_MONTHLY_CAP } from '~/utils/vacationReservations';
import { isReservationCapExemptSubgroupId } from '~/utils/vacationDepartmentGroups';

export { DEFAULT_RESERVATION_MONTHLY_CAP };

/** Лимит броней на месяц внутри одной подгруппы отдела. */
export const DEFAULT_SUBGROUP_RESERVATION_MONTHLY_CAP = 1;

export const RESERVATION_CAP_DEPARTMENT_BLOCKED_MESSAGE =
  'Уже максимум сотрудников заняли этот месяц в отделе (бронь или отпуск). Больше нельзя — договоритесь поменяться или выберите другой месяц.';

export const RESERVATION_CAP_SUBGROUP_BLOCKED_MESSAGE =
  'В вашей группе этот месяц уже занят (бронь или отпуск). Договоритесь с коллегами или выберите другой месяц.';

/** Заявка с датами упёрлась в лимит отдела: в какой-то день диапазона отдыхает уже cap человек. */
export const vacationRequestDepartmentCapBlockedMessage = (cap: number) =>
  `В эти даты в отделе уже отдыхает максимум сотрудников (${cap}). Выберите другие даты или договоритесь с коллегами.`;

/** @deprecated Используйте RESERVATION_CAP_DEPARTMENT_BLOCKED_MESSAGE */
export const RESERVATION_CAP_BLOCKED_MESSAGE = RESERVATION_CAP_DEPARTMENT_BLOCKED_MESSAGE;

export type ReservationMonthlyCapsByGroup = Record<string, number>;

export type ReservationCapScope = {
  id: string;
  memberNames: string[];
};

export type EmployeeReservationCapContext = {
  department: ReservationCapScope & { label: string };
  subgroup: ReservationCapScope & { label: string };
};

export type ReservationCapBlockReason = 'department' | 'subgroup';

export function getDepartmentReservationMonthlyCap(
  poolId: string,
  caps?: ReservationMonthlyCapsByGroup
): number {
  const custom = caps?.[poolId];
  if (typeof custom === 'number' && Number.isFinite(custom) && custom >= 1) {
    return Math.floor(custom);
  }
  return DEFAULT_RESERVATION_MONTHLY_CAP;
}

export function getSubgroupReservationMonthlyCap(
  subgroupId: string,
  caps?: ReservationMonthlyCapsByGroup
): number {
  const custom = caps?.[subgroupId];
  if (typeof custom === 'number' && Number.isFinite(custom) && custom >= 1) {
    return Math.floor(custom);
  }
  return DEFAULT_SUBGROUP_RESERVATION_MONTHLY_CAP;
}

/** @deprecated Используйте getDepartmentReservationMonthlyCap для пула отдела */
export function getReservationMonthlyCap(
  groupId: string,
  caps?: ReservationMonthlyCapsByGroup
): number {
  return getDepartmentReservationMonthlyCap(groupId, caps);
}

export function countGroupReservationsForMonth(
  groupMemberNames: Set<string> | string[],
  year: number,
  month: number,
  reservations: VacationReservation[],
  excludeEmployee?: string
): number {
  const names = groupMemberNames instanceof Set ? groupMemberNames : new Set(groupMemberNames);
  const exclude = excludeEmployee?.trim().toLowerCase();
  const seen = new Set<string>();

  for (const row of reservations) {
    if (row.year !== year || row.month !== month) continue;
    const employee = row.employee.trim();
    if (!names.has(employee)) continue;
    if (exclude && employee.toLowerCase() === exclude) continue;
    seen.add(employee.toLowerCase());
  }

  return seen.size;
}

const parseIsoToDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const requestOverlapsMonth = (req: { start: string; end: string }, year: number, month: number) => {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const start = parseIsoToDate(req.start);
  const end = parseIsoToDate(req.end);
  return !(end < monthStart || start > monthEnd);
};

export function countGroupVacationRequestsForMonth(
  groupMemberNames: Set<string> | string[],
  year: number,
  month: number,
  requests: VacationRequest[],
  excludeEmployee?: string
): number {
  const names = groupMemberNames instanceof Set ? groupMemberNames : new Set(groupMemberNames);
  const exclude = excludeEmployee?.trim().toLowerCase();
  const seen = new Set<string>();

  for (const row of requests) {
    if (row.status !== 'approved' && row.status !== 'pending') continue;
    if (!names.has(row.employee)) continue;
    if (exclude && row.employee.toLowerCase() === exclude) continue;
    if (!requestOverlapsMonth(row, year, month)) continue;
    seen.add(row.employee.toLowerCase());
  }

  return seen.size;
}

export function countGroupVacationSlotsForMonth(params: {
  groupMemberNames: Set<string> | string[];
  year: number;
  month: number;
  reservations: VacationReservation[];
  requests: VacationRequest[];
  excludeEmployee?: string;
}): number {
  const names = params.groupMemberNames instanceof Set ? params.groupMemberNames : new Set(params.groupMemberNames);
  const exclude = params.excludeEmployee?.trim().toLowerCase();
  const seen = new Set<string>();

  for (const row of params.reservations) {
    if (row.year !== params.year || row.month !== params.month) continue;
    if (!names.has(row.employee)) continue;
    if (exclude && row.employee.toLowerCase() === exclude) continue;
    seen.add(row.employee.toLowerCase());
  }

  for (const row of params.requests) {
    if (row.status !== 'approved' && row.status !== 'pending') continue;
    if (!names.has(row.employee)) continue;
    if (exclude && row.employee.toLowerCase() === exclude) continue;
    if (!requestOverlapsMonth(row, params.year, params.month)) continue;
    seen.add(row.employee.toLowerCase());
  }

  return seen.size;
}

/** Месяцы (1–12), которые пересекает период start…end включительно. */
export function monthsOverlappingIsoRange(
  start: string,
  end: string
): { year: number; month: number }[] {
  const rangeStart = parseIsoToDate(start);
  const rangeEnd = parseIsoToDate(end);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeEnd < rangeStart) {
    return [];
  }

  const out: { year: number; month: number }[] = [];
  let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const last = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  while (cursor <= last) {
    out.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}

export function isReservationMonthAtDepartmentCap(params: {
  poolId: string;
  memberNames: string[];
  year: number;
  month: number;
  reservations: VacationReservation[];
  requests?: VacationRequest[];
  caps?: ReservationMonthlyCapsByGroup;
  excludeEmployee?: string;
}): boolean {
  const cap = getDepartmentReservationMonthlyCap(params.poolId, params.caps);
  const count = countGroupVacationSlotsForMonth({
    groupMemberNames: params.memberNames,
    year: params.year,
    month: params.month,
    reservations: params.reservations,
    requests: params.requests ?? [],
    excludeEmployee: params.excludeEmployee
  });
  return count >= cap;
}

export function isReservationMonthAtSubgroupCap(params: {
  subgroupId: string;
  memberNames: string[];
  year: number;
  month: number;
  reservations: VacationReservation[];
  requests?: VacationRequest[];
  caps?: ReservationMonthlyCapsByGroup;
  excludeEmployee?: string;
}): boolean {
  const cap = getSubgroupReservationMonthlyCap(params.subgroupId, params.caps);
  const count = countGroupVacationSlotsForMonth({
    groupMemberNames: params.memberNames,
    year: params.year,
    month: params.month,
    reservations: params.reservations,
    requests: params.requests ?? [],
    excludeEmployee: params.excludeEmployee
  });
  return count >= cap;
}

/**
 * Перечисляет дни диапазона [start; end] включительно как метки времени (локальная полночь).
 * Диапазоны заявок короткие (отпуск), поэтому дневной перебор дешёвый и самый понятный способ
 * проверить настоящее пересечение дат.
 */
function enumerateDayTimestamps(start: Date, end: Date): number[] {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const out: number[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor.getTime() <= last.getTime()) {
    out.push(cursor.getTime());
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * Общая проверка лимита для ЗАЯВКИ с настоящими датами (start/end): считаем реальное
 * пересечение дней, а не «касание месяца». Блок, если хотя бы в один день диапазона
 * уже отсутствует cap человек из memberNames (то есть с заявителем было бы cap + 1).
 *
 * Важно про брони (VacationReservation): у них нет точных дат, только {year, month, durationDays}
 * («где-то в этом месяце, ~N дней»). Посчитать для них настоящее пересечение по дням нельзя:
 * данных недостаточно. Поэтому бронь другого человека здесь СОЗНАТЕЛЬНО считается занимающей
 * весь месяц целиком (консервативно). Это намеренное решение: лучше изредка перестраховаться
 * для брони без дат, чем выдумать несуществующую точность.
 */
function isRequestRangeAtOccupancyCap(params: {
  cap: number;
  memberNames: string[];
  start: string;
  end: string;
  reservations: VacationReservation[];
  requests: VacationRequest[];
  excludeEmployee?: string;
}): boolean {
  const { cap } = params;
  const names = new Set(params.memberNames.map((name) => name.trim()));
  const exclude = params.excludeEmployee?.trim().toLowerCase();

  const ownDays = enumerateDayTimestamps(parseIsoToDate(params.start), parseIsoToDate(params.end));
  if (!ownDays.length) return false;

  type Occupancy = { employee: string; start: number; end: number };
  const occupancies: Occupancy[] = [];

  // Брони других сотрудников: без точных дат, занимают месяц целиком (консервативно).
  for (const row of params.reservations) {
    const employee = row.employee.trim();
    if (!names.has(employee)) continue;
    if (exclude && employee.toLowerCase() === exclude) continue;
    occupancies.push({
      employee: employee.toLowerCase(),
      start: new Date(row.year, row.month - 1, 1).getTime(),
      end: new Date(row.year, row.month, 0).getTime()
    });
  }

  // Заявки других сотрудников (approved + pending): настоящие даты start/end.
  for (const row of params.requests) {
    if (row.status !== 'approved' && row.status !== 'pending') continue;
    const employee = row.employee.trim();
    if (!names.has(employee)) continue;
    if (exclude && employee.toLowerCase() === exclude) continue;
    occupancies.push({
      employee: employee.toLowerCase(),
      start: parseIsoToDate(row.start).getTime(),
      end: parseIsoToDate(row.end).getTime()
    });
  }

  if (occupancies.length < cap) return false;

  for (const dayTs of ownDays) {
    const occupantsToday = new Set<string>();
    for (const occ of occupancies) {
      if (dayTs >= occ.start && dayTs <= occ.end) occupantsToday.add(occ.employee);
    }
    if (occupantsToday.size >= cap) return true;
  }
  return false;
}

/**
 * Лимит подгруппы для заявки с датами: реальное пересечение дней.
 *
 * Пример: у Маши отпуск 26 окт – 1 ноя (касается ноября только 1 днём). Коля хочет 9–22 ноя.
 * Их диапазоны не пересекаются ни одним днём → Коля не блокируется, хотя оба «в ноябре».
 */
export function isRequestRangeAtSubgroupCap(params: {
  subgroupId: string;
  memberNames: string[];
  start: string;
  end: string;
  reservations: VacationReservation[];
  requests: VacationRequest[];
  caps?: ReservationMonthlyCapsByGroup;
  excludeEmployee?: string;
}): boolean {
  return isRequestRangeAtOccupancyCap({
    ...params,
    cap: getSubgroupReservationMonthlyCap(params.subgroupId, params.caps)
  });
}

/**
 * Лимит отдела («5 на отдел») для заявки с датами: в любой день отсутствует не больше cap
 * человек отдела. Пример (Digital, окт 2026): Цхай 05–18, Хакимов 12–21, Седова 19–20,
 * Девочкина 26.10–08.11, Бояринова 26.10–01.11. Все пятеро «в октябре», но 29–30.10 отдыхают
 * только двое, поэтому заявка на 29–30.10 проходит.
 */
export function isRequestRangeAtDepartmentCap(params: {
  poolId: string;
  memberNames: string[];
  start: string;
  end: string;
  reservations: VacationReservation[];
  requests: VacationRequest[];
  caps?: ReservationMonthlyCapsByGroup;
  excludeEmployee?: string;
}): boolean {
  return isRequestRangeAtOccupancyCap({
    ...params,
    cap: getDepartmentReservationMonthlyCap(params.poolId, params.caps)
  });
}

export function getReservationMonthBlockReason(params: {
  context: EmployeeReservationCapContext;
  year: number;
  month: number;
  reservations: VacationReservation[];
  requests?: VacationRequest[];
  caps?: ReservationMonthlyCapsByGroup;
  excludeEmployee?: string;
}): ReservationCapBlockReason | null {
  const { context, year, month, reservations, requests, caps, excludeEmployee } = params;

  // Группа Цхай и др.: без лимита «1 в подгруппе», но отдел «5» остаётся.
  const skipSubgroup = isReservationCapExemptSubgroupId(context.subgroup.id);

  if (
    !skipSubgroup &&
    isReservationMonthAtSubgroupCap({
      subgroupId: context.subgroup.id,
      memberNames: context.subgroup.memberNames,
      year,
      month,
      reservations,
      requests,
      caps,
      excludeEmployee
    })
  ) {
    return 'subgroup';
  }

  if (
    isReservationMonthAtDepartmentCap({
      poolId: context.department.id,
      memberNames: context.department.memberNames,
      year,
      month,
      reservations,
      requests,
      caps,
      excludeEmployee
    })
  ) {
    return 'department';
  }

  return null;
}

/**
 * Блок лимита для заявки с датами (start/end).
 *
 * И подгруппа, и отдел считаются по реальному пересечению дней (isRequestRangeAtOccupancyCap):
 * блок, только если хотя бы в один день диапазона уже отсутствует cap человек.
 * Брони (без дат) занимают свой месяц целиком. Исключение группы Цхай: пропускается только
 * лимит подгруппы, лимит отдела действует (vacation-tskhai-no-reservation-caps.mdc).
 *
 * Брони (getReservationMonthBlockReason) остаются помесячными: бронь сама занимает месяц целиком.
 */
export function getReservationRangeBlockReason(params: {
  context: EmployeeReservationCapContext;
  start: string;
  end: string;
  reservations: VacationReservation[];
  requests?: VacationRequest[];
  caps?: ReservationMonthlyCapsByGroup;
  excludeEmployee?: string;
}): ReservationCapBlockReason | null {
  const skipSubgroup = isReservationCapExemptSubgroupId(params.context.subgroup.id);

  if (
    !skipSubgroup &&
    isRequestRangeAtSubgroupCap({
      subgroupId: params.context.subgroup.id,
      memberNames: params.context.subgroup.memberNames,
      start: params.start,
      end: params.end,
      reservations: params.reservations,
      requests: params.requests ?? [],
      caps: params.caps,
      excludeEmployee: params.excludeEmployee
    })
  ) {
    return 'subgroup';
  }

  if (
    isRequestRangeAtDepartmentCap({
      poolId: params.context.department.id,
      memberNames: params.context.department.memberNames,
      start: params.start,
      end: params.end,
      reservations: params.reservations,
      requests: params.requests ?? [],
      caps: params.caps,
      excludeEmployee: params.excludeEmployee
    })
  ) {
    return 'department';
  }

  return null;
}

export function reservationCapBlockMessage(reason: ReservationCapBlockReason): string {
  return reason === 'subgroup'
    ? RESERVATION_CAP_SUBGROUP_BLOCKED_MESSAGE
    : RESERVATION_CAP_DEPARTMENT_BLOCKED_MESSAGE;
}

/** Текст блока для заявки с датами (лимит отдела называет число из настроек). */
export function vacationRequestCapBlockMessage(
  reason: ReservationCapBlockReason,
  context: EmployeeReservationCapContext,
  caps?: ReservationMonthlyCapsByGroup
): string {
  return reason === 'subgroup'
    ? RESERVATION_CAP_SUBGROUP_BLOCKED_MESSAGE
    : vacationRequestDepartmentCapBlockedMessage(
        getDepartmentReservationMonthlyCap(context.department.id, caps)
      );
}

/** @deprecated Используйте getReservationMonthBlockReason */
export function isReservationMonthAtGroupCap(params: {
  groupId: string;
  groupMemberNames: string[];
  year: number;
  month: number;
  reservations: VacationReservation[];
  requests?: VacationRequest[];
  caps?: ReservationMonthlyCapsByGroup;
  excludeEmployee?: string;
}): boolean {
  const cap = getDepartmentReservationMonthlyCap(params.groupId, params.caps);
  const count = countGroupVacationSlotsForMonth({
    groupMemberNames: params.groupMemberNames,
    year: params.year,
    month: params.month,
    reservations: params.reservations,
    requests: params.requests ?? [],
    excludeEmployee: params.excludeEmployee
  });
  return count >= cap;
}
