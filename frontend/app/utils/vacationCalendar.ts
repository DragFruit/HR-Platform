export const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export const WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

/** Все месяцы в годовом календаре — одна высота (5 или 6 недель → всегда 6) */
export const EMP_MONTH_WEEK_ROWS = 6;

const RU_PROD_CAL_OFF_BY_YEAR: Record<number, Set<string>> = {
  2026: new Set([
    '2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09',
    '2026-02-21', '2026-02-22', '2026-02-23', '2026-03-07', '2026-03-08', '2026-03-09',
    '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-09', '2026-05-10', '2026-05-11',
    '2026-06-12', '2026-06-13', '2026-06-14', '2026-11-04', '2026-12-31'
  ]),
  // Проект Минтруда / Правительство РФ о переносах 2027 (как у 2026 — длинные «каникулы», не только ст. 112).
  2027: new Set([
    '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04', '2027-01-05',
    '2027-01-06', '2027-01-07', '2027-01-08', '2027-01-09', '2027-01-10',
    '2027-02-21', '2027-02-22', '2027-02-23',
    '2027-03-06', '2027-03-07', '2027-03-08',
    '2027-05-01', '2027-05-02', '2027-05-03', '2027-05-08', '2027-05-09', '2027-05-10',
    '2027-06-12', '2027-06-13', '2027-06-14',
    '2027-11-04', '2027-11-05', '2027-11-06', '2027-11-07',
    '2027-12-31'
  ])
};

export const toIso = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const todayIso = () => toIso(new Date());

export const normalizeRange = (start: string, end: string): [string, string] =>
  start <= end ? [start, end] : [end, start];

export const isIsoInRange = (iso: string, start: string, end: string) => {
  const [lo, hi] = normalizeRange(start, end);
  return iso >= lo && iso <= hi;
};

export const isDaySelectable = (
  cell: Pick<CalendarDayCell, 'empty' | 'iso' | 'approved' | 'pending'>,
  minIso: string
) => !cell.empty && cell.iso >= minIso && !cell.approved && !cell.pending;

export const isRangeFullySelectable = (
  start: string,
  end: string,
  minIso: string,
  blocked: Set<string>
) => {
  const [lo, hi] = normalizeRange(start, end);
  if (lo < minIso) return false;
  const cursor = new Date(`${lo}T00:00:00`);
  const endDate = new Date(`${hi}T00:00:00`);
  while (cursor <= endDate) {
    const iso = toIso(cursor);
    if (blocked.has(iso) || iso < minIso) return false;
    cursor.setDate(cursor.getDate() + 1);
  }
  return true;
};

export const isWeekendDay = (date: Date) => {
  const w = date.getDay();
  return w === 0 || w === 6;
};

export const isRuHoliday = (iso: string) => {
  const y = Number(iso.slice(0, 4));
  const set = RU_PROD_CAL_OFF_BY_YEAR[y];
  return Boolean(set?.has(iso));
};

export const isInRangePreview = (
  iso: string,
  start: string,
  hover: string | null
) => {
  const end = hover ?? start;
  if (!isIsoInRange(iso, start, end)) return false;
  return !isRuHoliday(iso);
};

export const rangePreviewSegmentClass = (
  iso: string,
  start: string,
  hover: string | null
): string => {
  if (isRuHoliday(iso)) return '';
  const end = hover ?? start;
  const [lo, hi] = normalizeRange(start, end);
  if (iso < lo || iso > hi) return '';
  if (lo === hi) return 'emp-range-seg-single';
  if (iso === lo) return 'emp-range-seg-start';
  if (iso === hi) return 'emp-range-seg-end';
  return 'emp-range-seg-mid';
};

export type CalendarDayCell = {
  iso: string;
  day: number;
  empty: boolean;
  weekend: boolean;
  holiday: boolean;
  approved: boolean;
  pending: boolean;
  segmentClass: string;
};

export const buildDaySetsForEmployee = (
  employeeName: string,
  year: number,
  requests: { employee: string; start: string; end: string; status: string }[]
) => {
  const approved = new Set<string>();
  const pending = new Set<string>();

  requests
    .filter((r) => r.employee === employeeName)
    .forEach((r) => {
      const start = new Date(`${r.start}T00:00:00`);
      const end = new Date(`${r.end}T00:00:00`);
      const cursor = new Date(start);
      while (cursor <= end) {
        if (cursor.getFullYear() === year) {
          const iso = toIso(cursor);
          if (r.status === 'approved') approved.add(iso);
          if (r.status === 'pending') pending.add(iso);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    });

  return { approved, pending };
};

const segmentClasses = (cells: CalendarDayCell[], key: 'approved' | 'pending') => {
  const prefix = key === 'approved' ? 'emp-appr' : 'emp-pend';
  const flag = key === 'approved' ? 'approved' : 'pending';
  let i = 0;
  while (i < cells.length) {
    if (!cells[i]?.[flag]) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < cells.length && cells[j]?.[flag]) j += 1;
    const len = j - i;
    cells[i].segmentClass =
      len === 1 ? `${prefix}-seg-single` : `${prefix}-seg-start`;
    for (let k = i + 1; k < j - 1; k++) cells[k].segmentClass = `${prefix}-seg-mid`;
    if (len > 1) cells[j - 1].segmentClass = `${prefix}-seg-end`;
    i = j;
  }
};

export const buildMonthGrid = (
  year: number,
  month: number,
  approved: Set<string>,
  pending: Set<string>
): CalendarDayCell[][] => {
  const dim = new Date(year, month + 1, 0).getDate();
  const first = new Date(year, month, 1);
  let startPad = (first.getDay() + 6) % 7;
  const rows: CalendarDayCell[][] = [];
  let day = 1;

  while (day <= dim) {
    const row: CalendarDayCell[] = [];
    for (let col = 0; col < 7; col++) {
      if ((day === 1 && col < startPad) || day > dim) {
        row.push({
          iso: '',
          day: 0,
          empty: true,
          weekend: false,
          holiday: false,
          approved: false,
          pending: false,
          segmentClass: ''
        });
        continue;
      }
      const dt = new Date(year, month, day);
      const iso = toIso(dt);
      const isAppr = approved.has(iso);
      const isPend = pending.has(iso);
      row.push({
        iso,
        day,
        empty: false,
        weekend: !isRuHoliday(iso) && isWeekendDay(dt),
        holiday: isRuHoliday(iso),
        approved: isAppr,
        pending: !isAppr && isPend,
        segmentClass: ''
      });
      day += 1;
    }
    segmentClasses(row, 'approved');
    segmentClasses(row, 'pending');
    rows.push(row);
  }

  return rows;
};

export const countInclusiveCalendarDays = (startStr: string, endStr: string) => {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
  let n = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    n += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return n;
};

/** Дни в счёт отпуска: календарные, без праздников (выходные входят). */
export const countVacationBillableDays = (startStr: string, endStr: string) => {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
  let n = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (!isRuHoliday(toIso(cursor))) n += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return n;
};

/** Обрезать диапазон до календарного года; null если пересечения нет. */
export const clipIsoRangeToYear = (
  startStr: string,
  endStr: string,
  year: number
): [string, string] | null => {
  const yStart = `${year}-01-01`;
  const yEnd = `${year}-12-31`;
  const lo = startStr > yStart ? startStr : yStart;
  const hi = endStr < yEnd ? endStr : yEnd;
  if (!lo || !hi || lo > hi) return null;
  return [lo, hi];
};

/** Billable-дни заявки, попадающие в указанный календарный год. */
export const countVacationBillableDaysInYear = (
  startStr: string,
  endStr: string,
  year: number
) => {
  const clipped = clipIsoRangeToYear(startStr, endStr, year);
  if (!clipped) return 0;
  return countVacationBillableDays(clipped[0], clipped[1]);
};

export const vacationRangesOverlap = (
  startA: string,
  endA: string,
  startB: string,
  endB: string
) => {
  const a0 = new Date(`${startA}T00:00:00`);
  const a1 = new Date(`${endA}T00:00:00`);
  const b0 = new Date(`${startB}T00:00:00`);
  const b1 = new Date(`${endB}T00:00:00`);
  if ([a0, a1, b0, b1].some((d) => Number.isNaN(d.getTime()))) return false;
  return a0 <= b1 && b0 <= a1;
};

export type VacationOverlapDetail = {
  employee: string;
  vacationStart: string;
  vacationEnd: string;
  overlapStart: string;
  overlapEnd: string;
};

export const vacationOverlapPeriod = (
  startA: string,
  endA: string,
  startB: string,
  endB: string
): { overlapStart: string; overlapEnd: string } | null => {
  if (!vacationRangesOverlap(startA, endA, startB, endB)) return null;
  const a0 = new Date(`${startA}T00:00:00`);
  const a1 = new Date(`${endA}T00:00:00`);
  const b0 = new Date(`${startB}T00:00:00`);
  const b1 = new Date(`${endB}T00:00:00`);
  const from = a0 > b0 ? a0 : b0;
  const to = a1 < b1 ? a1 : b1;
  return { overlapStart: toIso(from), overlapEnd: toIso(to) };
};

export const findVacationOverlapDetails = (
  request: { id: number; employee: string; start: string; end: string },
  allRequests: { id: number; employee: string; start: string; end: string; status: string }[],
  scopeEmployeeNames?: string[]
): VacationOverlapDetail[] => {
  const scope = scopeEmployeeNames ? new Set(scopeEmployeeNames) : null;
  const details: VacationOverlapDetail[] = [];

  allRequests.forEach((other) => {
    if (other.id === request.id || other.employee === request.employee) return;
    if (other.status !== 'approved' && other.status !== 'pending') return;
    if (scope && !scope.has(other.employee)) return;
    const overlap = vacationOverlapPeriod(request.start, request.end, other.start, other.end);
    if (!overlap) return;
    details.push({
      employee: other.employee,
      vacationStart: other.start,
      vacationEnd: other.end,
      overlapStart: overlap.overlapStart,
      overlapEnd: overlap.overlapEnd
    });
  });

  return details.sort((a, b) => {
    const byName = a.employee.localeCompare(b.employee, 'ru');
    if (byName !== 0) return byName;
    return a.vacationStart.localeCompare(b.vacationStart);
  });
};

/** Согласованный отпуск с прошедшими датами — только просмотр, без правок. */
export const isPastApprovedVacationRequest = (
  request: { status: string; end: string },
  asOf = todayIso()
) => request.status === 'approved' && request.end < asOf;

/** ФИО с отпуском, пересекающим день (по умолчанию только approved). */
export const namesOnVacationOnIso = (
  requests: Array<{ employee: string; start: string; end: string; status: string }>,
  iso: string,
  options?: {
    statuses?: string[];
    scopeNames?: Iterable<string>;
  }
): string[] => {
  const statuses = new Set(options?.statuses ?? ['approved']);
  const scope = options?.scopeNames ? new Set(options.scopeNames) : null;
  const active = new Set<string>();
  for (const req of requests) {
    if (!statuses.has(req.status)) continue;
    if (scope && !scope.has(req.employee)) continue;
    if (!isIsoInRange(iso, req.start, req.end)) continue;
    active.add(req.employee);
  }
  return [...active].sort((a, b) => a.localeCompare(b, 'ru'));
};
