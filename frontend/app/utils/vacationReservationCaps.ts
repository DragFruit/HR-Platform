import type { VacationReservation } from '~/utils/vacationReservations';
import type { VacationRequest } from '~/composables/useVacations';
import { DEFAULT_RESERVATION_MONTHLY_CAP } from '~/utils/vacationReservations';

export { DEFAULT_RESERVATION_MONTHLY_CAP };

/** Лимит броней на месяц внутри одной подгруппы отдела. */
export const DEFAULT_SUBGROUP_RESERVATION_MONTHLY_CAP = 1;

export const RESERVATION_CAP_DEPARTMENT_BLOCKED_MESSAGE =
  'Уже максимум сотрудников взяли бронь на этот месяц в отделе. Больше нельзя — договоритесь поменяться или забронируйте другой месяц.';

export const RESERVATION_CAP_SUBGROUP_BLOCKED_MESSAGE =
  'В вашей группе уже есть бронь на этот месяц. Договоритесь с коллегами или выберите другой месяц.';

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

export function isReservationMonthAtDepartmentCap(params: {
  poolId: string;
  memberNames: string[];
  year: number;
  month: number;
  reservations: VacationReservation[];
  caps?: ReservationMonthlyCapsByGroup;
  excludeEmployee?: string;
}): boolean {
  const cap = getDepartmentReservationMonthlyCap(params.poolId, params.caps);
  const count = countGroupReservationsForMonth(
    params.memberNames,
    params.year,
    params.month,
    params.reservations,
    params.excludeEmployee
  );
  return count >= cap;
}

export function isReservationMonthAtSubgroupCap(params: {
  subgroupId: string;
  memberNames: string[];
  year: number;
  month: number;
  reservations: VacationReservation[];
  caps?: ReservationMonthlyCapsByGroup;
  excludeEmployee?: string;
}): boolean {
  const cap = getSubgroupReservationMonthlyCap(params.subgroupId, params.caps);
  const count = countGroupReservationsForMonth(
    params.memberNames,
    params.year,
    params.month,
    params.reservations,
    params.excludeEmployee
  );
  return count >= cap;
}

export function getReservationMonthBlockReason(params: {
  context: EmployeeReservationCapContext;
  year: number;
  month: number;
  reservations: VacationReservation[];
  caps?: ReservationMonthlyCapsByGroup;
  excludeEmployee?: string;
}): ReservationCapBlockReason | null {
  const { context, year, month, reservations, caps, excludeEmployee } = params;

  if (
    isReservationMonthAtSubgroupCap({
      subgroupId: context.subgroup.id,
      memberNames: context.subgroup.memberNames,
      year,
      month,
      reservations,
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
      caps,
      excludeEmployee
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
  const count = countGroupReservationsForMonth(
    params.groupMemberNames,
    params.year,
    params.month,
    params.reservations,
    params.excludeEmployee
  );
  return count >= cap;
}
