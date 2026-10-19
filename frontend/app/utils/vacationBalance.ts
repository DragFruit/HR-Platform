import type { VacationRequest } from '~/composables/useVacations';
import { vacationBelongsToEmployee } from '~/utils/vacationEmployeeRef';
import {
  clipIsoRangeToYear,
  countVacationBillableDays,
  countVacationBillableDaysInYear,
  isRuHoliday,
  toIso
} from '~/utils/vacationCalendar';

export type VacationBalanceAssessment = {
  status: 'ok' | 'advance' | 'unknown' | 'incomplete';
  neededDays: number;
  availableAtStart: number;
  deficit: number;
  startLabel: string;
};

const ANNUAL_NORM = 28;

const normalizeCalendarDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const calendarDaysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

const zupHalfMonthLength = (dim: number) => Math.floor((dim + 1) / 2);

const zupClassifyFirstMonth = (hireNorm: Date) => {
  const hy = hireNorm.getFullYear();
  const hm = hireNorm.getMonth();
  const hd = hireNorm.getDate();
  const dim0 = calendarDaysInMonth(hy, hm);
  const daysWorkedTail = dim0 - hd + 1;
  const half = zupHalfMonthLength(dim0);
  const case17In31 = hd === 17 && dim0 === 31;
  const scrapTarget = case17In31 ? 16 : 15;
  return { case1: daysWorkedTail >= half, scrapTarget };
};

const zupCountAccrualsCase1 = (hireNorm: Date, asOfNorm: Date) => {
  const hd = hireNorm.getDate();
  let y = hireNorm.getFullYear();
  let m = hireNorm.getMonth();
  let count = 0;
  for (;;) {
    const dimM = calendarDaysInMonth(y, m);
    const refDay = hd === 1 ? 1 : Math.min(dimM, hd - 1);
    const half = zupHalfMonthLength(dimM);
    const accDay = Math.min(dimM, refDay + half);
    const accDate = normalizeCalendarDate(new Date(y, m, accDay));
    if (accDate >= hireNorm && accDate <= asOfNorm) count += 1;
    if (y === asOfNorm.getFullYear() && m === asOfNorm.getMonth()) break;
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return count;
};

const zupCountAccrualsCase2 = (hireNorm: Date, asOfNorm: Date, scrapTarget: number) => {
  const dim0 = calendarDaysInMonth(hireNorm.getFullYear(), hireNorm.getMonth());
  const baseScrap = dim0 - hireNorm.getDate() + 1;
  const accDayInMonth = scrapTarget - baseScrap;
  if (accDayInMonth < 1) return 0;
  let y = hireNorm.getFullYear();
  let m = hireNorm.getMonth() + 1;
  if (m > 11) {
    m = 0;
    y += 1;
  }
  let count = 0;
  for (;;) {
    const dimM = calendarDaysInMonth(y, m);
    const day = Math.min(dimM, accDayInMonth);
    const accDate = normalizeCalendarDate(new Date(y, m, day));
    if (accDate > asOfNorm) break;
    count += 1;
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    if (count > 2400) break;
  }
  return count;
};

const zupCountAccrualEvents = (hireIso: string, asOfDate: Date) => {
  const hireNorm = normalizeCalendarDate(new Date(`${hireIso}T12:00:00`));
  const asOfNorm = normalizeCalendarDate(asOfDate);
  if (Number.isNaN(hireNorm.getTime()) || hireNorm > asOfNorm) return 0;
  const cl = zupClassifyFirstMonth(hireNorm);
  return cl.case1
    ? zupCountAccrualsCase1(hireNorm, asOfNorm)
    : zupCountAccrualsCase2(hireNorm, asOfNorm, cl.scrapTarget);
};

const accruedVacationZupFromHire = (hireIso: string, asOfDate: Date) => {
  const n = zupCountAccrualEvents(hireIso, asOfDate);
  return Math.floor(((n * ANNUAL_NORM) / 12) * 10) / 10;
};

/**
 * Списанные billable-дни в рамках учётного года.
 * Заявка через НГ лежит в папке года начала — январский хвост всё равно
 * списывается из баланса года, в который попали дни.
 */
const countBookedDays = (
  empName: string,
  hireIso: string,
  requests: VacationRequest[],
  statuses: VacationRequest['status'][],
  accountYear: number
) => {
  const hireDay = normalizeCalendarDate(new Date(`${hireIso}T12:00:00`));
  const want = new Set(statuses);
  let n = 0;
  requests.forEach((r) => {
    if (!vacationBelongsToEmployee(r, empName) || !want.has(r.status)) return;
    const clipped = clipIsoRangeToYear(r.start, r.end, accountYear);
    if (!clipped) return;
    const start = normalizeCalendarDate(new Date(`${clipped[0]}T00:00:00`));
    const end = normalizeCalendarDate(new Date(`${clipped[1]}T00:00:00`));
    if (start > end) return;
    const from = start > hireDay ? start : hireDay;
    if (from > end) return;
    const cursor = new Date(from);
    while (cursor <= end) {
      const iso = toIso(cursor);
      if (!isRuHoliday(iso)) n += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return n;
};

const countBookedDaysUpTo = (
  empName: string,
  hireIso: string,
  requests: VacationRequest[],
  status: VacationRequest['status'],
  asOfDay: Date,
  accountYear: number
) => {
  const hireDay = normalizeCalendarDate(new Date(`${hireIso}T12:00:00`));
  let n = 0;
  requests.forEach((r) => {
    if (!vacationBelongsToEmployee(r, empName) || r.status !== status) return;
    const clipped = clipIsoRangeToYear(r.start, r.end, accountYear);
    if (!clipped) return;
    const start = normalizeCalendarDate(new Date(`${clipped[0]}T00:00:00`));
    const end = normalizeCalendarDate(new Date(`${clipped[1]}T00:00:00`));
    if (start > end) return;
    const from = start > hireDay ? start : hireDay;
    const to = end < asOfDay ? end : asOfDay;
    if (from > to) return;
    const cursor = new Date(from);
    while (cursor <= to) {
      const iso = toIso(cursor);
      if (!isRuHoliday(iso)) n += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return n;
};

const formatStartLabel = (startIso: string) =>
  new Date(`${startIso}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

export const assessVacationBalance = (
  employeeName: string,
  hireIso: string | undefined,
  start: string,
  end: string,
  requests: VacationRequest[],
  primaryYear: number,
  excludeRequestId?: number,
  openingBalance?: number | null
): VacationBalanceAssessment => {
  const empty: VacationBalanceAssessment = {
    status: 'incomplete',
    neededDays: 0,
    availableAtStart: 0,
    deficit: 0,
    startLabel: ''
  };

  if (!start || !end || end < start) return empty;
  if (!hireIso || !employeeName) {
    return { ...empty, status: 'unknown' };
  }

  // Для проверки «хватит ли» считаем дни в учётном году начала отпуска.
  const accountYear = Number(String(start).slice(0, 4)) || primaryYear;
  const neededDays = countVacationBillableDaysInYear(start, end, accountYear);
  const startLabel = formatStartLabel(start);
  if (neededDays === 0) {
    return { status: 'ok', neededDays: 0, availableAtStart: 0, deficit: 0, startLabel };
  }

  const filtered = excludeRequestId
    ? requests.filter((r) => r.id !== excludeRequestId)
    : requests;
  // Год впереди учётного: база на 01.01 — переходящий остаток на 31.12 предыдущих лет
  // (как при rollover), а не opening balance текущего учётного года.
  const opening = openingBalanceForYear(
    employeeName,
    hireIso,
    accountYear,
    filtered,
    primaryYear,
    openingBalance
  );
  const available = calcAvailableOnDate(
    employeeName,
    hireIso,
    start,
    filtered,
    accountYear,
    opening
  );
  if (available === null) {
    return { ...empty, status: 'unknown', neededDays, startLabel };
  }

  const deficit = roundToTenth(Math.max(0, neededDays - available));
  return {
    status: deficit > 0 ? 'advance' : 'ok',
    neededDays,
    availableAtStart: available,
    deficit,
    startLabel
  };
};

export const projectedAccruedVacationToDate = (
  hireIso: string,
  targetDate: Date,
  primaryYear: number
) => {
  const hireDay = normalizeCalendarDate(new Date(`${hireIso}T12:00:00`));
  const targetDay = normalizeCalendarDate(targetDate);
  const yStart = normalizeCalendarDate(new Date(primaryYear, 0, 1));
  if (targetDay < hireDay) return null;
  if (targetDay < yStart) return accruedVacationZupFromHire(hireIso, targetDay);
  const accY = accruedVacationZupFromHire(hireIso, yStart);
  const accT = accruedVacationZupFromHire(hireIso, targetDay);
  return Math.floor((accY + (accT - accY)) * 10) / 10;
};

const entitledVacationDays = (
  hireIso: string,
  asOf: Date,
  primaryYear: number,
  openingBalance?: number | null
) => {
  const jan1 = normalizeCalendarDate(new Date(primaryYear, 0, 1));
  const accruedAtJan1 = projectedAccruedVacationToDate(hireIso, jan1, primaryYear) ?? 0;
  const accruedNow = projectedAccruedVacationToDate(hireIso, asOf, primaryYear) ?? 0;
  const base = openingBalance ?? accruedAtJan1;
  const accrualSinceJan1 = Math.max(0, accruedNow - accruedAtJan1);
  return Math.floor((base + accrualSinceJan1) * 10) / 10;
};

export const calcEmployeeBalance = (
  employeeName: string,
  hireIso: string | undefined,
  requests: VacationRequest[],
  asOf = new Date(),
  primaryYear = 2026,
  openingBalance?: number | null,
  employeeId?: number | null
) => {
  if (!hireIso) return { remain: '—', taken: 0, planned: 0 };

  const yearRequests = requests.filter((r) =>
    vacationBelongsToEmployee(r, { id: employeeId, name: employeeName })
  );
  const today = normalizeCalendarDate(asOf);
  const todayIso = toIso(today);
  const yearStartIso = `${primaryYear}-01-01`;
  const yearEndIso = `${primaryYear}-12-31`;
  let taken = 0;
  let planned = 0;
  yearRequests.forEach((r) => {
    const clipped = clipIsoRangeToYear(r.start, r.end, primaryYear);
    if (!clipped) return;
    const [clipStart, clipEnd] = clipped;

    if (r.status === 'pending') {
      planned += countVacationBillableDays(clipStart, clipEnd);
      return;
    }
    if (r.status !== 'approved') return;

    const start = normalizeCalendarDate(new Date(`${clipStart}T00:00:00`));
    const end = normalizeCalendarDate(new Date(`${clipEnd}T00:00:00`));
    if (end < today) {
      taken += countVacationBillableDays(clipStart, clipEnd);
    } else if (start > today) {
      planned += countVacationBillableDays(clipStart, clipEnd);
    } else {
      const takenTo =
        todayIso < yearStartIso ? yearStartIso : todayIso > yearEndIso ? yearEndIso : todayIso;
      taken += countVacationBillableDays(clipStart, takenTo);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowIso = toIso(tomorrow);
      if (tomorrowIso <= clipEnd && tomorrowIso >= yearStartIso) {
        planned += countVacationBillableDays(tomorrowIso, clipEnd);
      }
    }
  });

  const entitled = entitledVacationDays(hireIso, asOf, primaryYear, openingBalance);
  const takenBooked = countBookedDays(employeeName, hireIso, requests, ['approved'], primaryYear);
  const plannedBooked = countBookedDays(employeeName, hireIso, requests, ['pending'], primaryYear);
  const remain = Math.max(
    0,
    Math.floor((entitled - takenBooked - plannedBooked) * 10) / 10
  );

  return { remain: String(remain), taken, planned };
};

export const calcAvailableOnDate = (
  employeeName: string,
  hireIso: string,
  targetIso: string,
  requests: VacationRequest[],
  primaryYear: number,
  openingBalance?: number | null
) => {
  const target = new Date(`${targetIso}T12:00:00`);
  const hireDay = normalizeCalendarDate(new Date(`${hireIso}T12:00:00`));
  const targetDay = normalizeCalendarDate(target);
  if (targetDay < hireDay) return null;

  const accrued = entitledVacationDays(hireIso, target, primaryYear, openingBalance);
  const takenThru = countBookedDaysUpTo(
    employeeName,
    hireIso,
    requests,
    'approved',
    targetDay,
    primaryYear
  );
  const pendingThru = countBookedDaysUpTo(
    employeeName,
    hireIso,
    requests,
    'pending',
    targetDay,
    primaryYear
  );
  return Math.max(0, Math.floor((accrued - takenThru - pendingThru) * 10) / 10);
};

/**
 * База остатка на 01.01.targetYear.
 * targetYear ≤ primaryYear — как раньше: `vacation_opening_balance` (или null → оценка ЗУП).
 * targetYear > primaryYear — цепочкой по годам: остаток на 31.12 каждого года (начисления минус
 * approved и pending этого года), ровно то же, что запишет переход года (`vacationYearRollover`).
 * `requests` — заявки всех нужных лет (папки primaryYear-1 … targetYear).
 */
export const openingBalanceForYear = (
  employeeName: string,
  hireIso: string,
  targetYear: number,
  requests: VacationRequest[],
  primaryYear: number,
  openingBalance?: number | null
): number | null | undefined => {
  if (!(targetYear > primaryYear)) return openingBalance;
  const hireYear = Number(String(hireIso).slice(0, 4));
  let opening: number | null | undefined = openingBalance;
  for (let year = primaryYear; year < targetYear; year += 1) {
    if (!Number.isNaN(hireYear) && hireYear > year) {
      opening = 0;
      continue;
    }
    const closing = calcAvailableOnDate(employeeName, hireIso, `${year}-12-31`, requests, year, opening);
    opening = closing === null ? 0 : Math.floor(closing * 10) / 10;
  }
  return opening;
};
