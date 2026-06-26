import type { VacationRequest } from '~/composables/useVacations';
import { countVacationBillableDays, isRuHoliday, toIso } from '~/utils/vacationCalendar';

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

const countBookedDays = (
  empName: string,
  hireIso: string,
  requests: VacationRequest[],
  statuses: VacationRequest['status'][]
) => {
  const hireDay = normalizeCalendarDate(new Date(`${hireIso}T12:00:00`));
  const want = new Set(statuses);
  let n = 0;
  requests.forEach((r) => {
    if (r.employee !== empName || !want.has(r.status)) return;
    const start = normalizeCalendarDate(new Date(`${r.start}T00:00:00`));
    const end = normalizeCalendarDate(new Date(`${r.end}T00:00:00`));
    if (start > end) return;
    const from = start > hireDay ? start : hireDay;
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
  asOfDay: Date
) => {
  const hireDay = normalizeCalendarDate(new Date(`${hireIso}T12:00:00`));
  let n = 0;
  requests.forEach((r) => {
    if (r.employee !== empName || r.status !== status) return;
    const start = normalizeCalendarDate(new Date(`${r.start}T00:00:00`));
    const end = normalizeCalendarDate(new Date(`${r.end}T00:00:00`));
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

  const neededDays = countVacationBillableDays(start, end);
  const startLabel = formatStartLabel(start);
  if (neededDays === 0) {
    return { status: 'ok', neededDays: 0, availableAtStart: 0, deficit: 0, startLabel };
  }

  const filtered = excludeRequestId
    ? requests.filter((r) => r.id !== excludeRequestId)
    : requests;
  const available = calcAvailableOnDate(
    employeeName,
    hireIso,
    start,
    filtered,
    primaryYear,
    openingBalance
  );
  if (available === null) {
    return { ...empty, status: 'unknown', neededDays, startLabel };
  }

  const deficit = Math.max(0, neededDays - available);
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
  openingBalance?: number | null
) => {
  if (!hireIso) return { remain: '—', taken: 0, planned: 0 };

  const yearRequests = requests.filter((r) => r.employee === employeeName);
  const today = normalizeCalendarDate(asOf);
  const todayIso = toIso(today);
  let taken = 0;
  let planned = 0;
  yearRequests.forEach((r) => {
    if (r.status === 'pending') {
      planned += countVacationBillableDays(r.start, r.end);
      return;
    }
    if (r.status !== 'approved') return;

    const start = normalizeCalendarDate(new Date(`${r.start}T00:00:00`));
    const end = normalizeCalendarDate(new Date(`${r.end}T00:00:00`));
    if (end < today) {
      taken += countVacationBillableDays(r.start, r.end);
    } else if (start > today) {
      planned += countVacationBillableDays(r.start, r.end);
    } else {
      taken += countVacationBillableDays(r.start, todayIso);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowIso = toIso(tomorrow);
      if (tomorrowIso <= r.end) {
        planned += countVacationBillableDays(tomorrowIso, r.end);
      }
    }
  });

  const entitled = entitledVacationDays(hireIso, asOf, primaryYear, openingBalance);
  const takenBooked = countBookedDays(employeeName, hireIso, requests, ['approved']);
  const plannedBooked = countBookedDays(employeeName, hireIso, requests, ['pending']);
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
  const takenThru = countBookedDaysUpTo(employeeName, hireIso, requests, 'approved', targetDay);
  const pendingThru = countBookedDaysUpTo(employeeName, hireIso, requests, 'pending', targetDay);
  return Math.max(0, Math.floor((accrued - takenThru - pendingThru) * 10) / 10);
};
