/**
 * PERSONAL_BIRTHDAY из Bitrix (user.get) → `YYYY-MM-DD` или `MM-DD`.
 *
 * Bitrix отдаёт дату в разных видах: ISO со временем и зоной
 * (`1990-03-12T03:00:00+03:00`), `12.03.1990`, иногда без года (`12.03`, `--03-12`)
 * или с «пустым» годом (`0000`, `1900`), когда сотрудник скрыл год.
 * Год, который нельзя считать настоящим, отбрасываем и храним только `MM-DD`.
 * Дату берём строкой, без `new Date()`, чтобы зона не сдвинула день.
 */

const pad2 = (n: number) => String(n).padStart(2, '0');

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isValidDayMonth(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= DAYS_IN_MONTH[month - 1]!;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Год «настоящий»: не заглушка (0000/1900) и не из будущего. */
function isRealYear(year: number, now: Date): boolean {
  return Number.isInteger(year) && year > 1900 && year <= now.getFullYear();
}

function build(year: number | null, month: number, day: number, now: Date): string | null {
  if (!isValidDayMonth(month, day)) return null;
  if (year != null && isRealYear(year, now)) {
    if (month === 2 && day === 29 && !isLeapYear(year)) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }
  return `${pad2(month)}-${pad2(day)}`;
}

export function normalizeBitrixBirthday(raw: unknown, now: Date = new Date()): string | null {
  if (raw == null || raw === false) return null;
  const value = String(raw).trim();
  if (!value) return null;

  // ISO: 1990-03-12, 1990-03-12T03:00:00+03:00, 0000-03-12
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]), now);

  // ISO без года: --03-12
  const isoNoYear = value.match(/^--(\d{1,2})-(\d{1,2})$/);
  if (isoNoYear) return build(null, Number(isoNoYear[1]), Number(isoNoYear[2]), now);

  // dd.mm.yyyy (с временем или без), dd.mm
  const dot = value.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?(?:$|\s)/);
  if (dot) {
    const year = dot[3] ? Number(dot[3]) : null;
    return build(year, Number(dot[2]), Number(dot[1]), now);
  }

  return null;
}

/** `YYYY-MM-DD` → `MM-DD` (год не отдаём тем, кому он не нужен). */
export function birthdayWithoutYear<T extends string | null | undefined>(birthday: T): T | string {
  if (typeof birthday !== 'string') return birthday;
  const full = birthday.trim().match(/^\d{4}-(\d{2}-\d{2})$/);
  return full ? full[1]! : birthday;
}
