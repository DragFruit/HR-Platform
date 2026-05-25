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
  ])
};

export const toIso = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
