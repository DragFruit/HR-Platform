export type VacationReservation = {
  id: number;
  employee: string;
  year: number;
  /** 1–12 */
  month: number;
  durationDays: number;
  comment?: string;
  createdAt: string;
  /** ISO-метка отправки напоминания в последний день месяца */
  expiry_notice_sent_at?: string;
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const lastDayOfMonth = (year: number, month: number) => new Date(year, month, 0);

/** Месяц брони полностью в прошлом */
export function isReservationMonthPast(year: number, month: number, now = new Date()): boolean {
  const today = startOfDay(now);
  const monthEnd = lastDayOfMonth(year, month);
  monthEnd.setHours(23, 59, 59, 999);
  return monthEnd < today;
}

/** Сегодня последний день месяца брони */
export function isReservationMonthLastDay(year: number, month: number, now = new Date()): boolean {
  const today = startOfDay(now);
  if (today.getFullYear() !== year || today.getMonth() + 1 !== month) return false;
  return today.getDate() === lastDayOfMonth(year, month).getDate();
}

/** Можно редактировать/удалять существующую бронь и создавать из неё заявку */
export function canManageReservationMonth(year: number, month: number, now = new Date()): boolean {
  return !isReservationMonthPast(year, month, now);
}

/** Можно поставить новую бронь на месяц (+бронь) */
export function canAddReservationForMonth(year: number, month: number, now = new Date()): boolean {
  if (!canManageReservationMonth(year, month, now)) return false;
  if (isReservationMonthLastDay(year, month, now)) return false;
  return true;
}

export type VacationMonthEntryKind = 'dated' | 'reservation';

export type VacationMonthEntry = {
  kind: VacationMonthEntryKind;
  status: 'approved' | 'pending' | 'reservation';
  label: string;
};

export const RESERVATION_DURATION_PRESETS = [
  { label: '3 дн.', days: 3 },
  { label: '5 дн.', days: 5 },
  { label: '1 нед.', days: 7 },
  { label: '2 нед.', days: 14 }
] as const;

export const RESERVATION_MIN_DAYS = 1;
export const RESERVATION_MAX_DAYS = 28;

export function formatReservationLabel(durationDays: number): string {
  if (durationDays === 7) return '1 нед.';
  if (durationDays === 14) return '2 нед.';
  return `${durationDays} дн.`;
}

export function formatReservationPeriod(
  year: number,
  month: number,
  durationDays: number,
  monthsRu: string[]
): string {
  const monthLabel = monthsRu[month - 1] ?? String(month);
  return `${monthLabel} ${year} · ${formatReservationLabel(durationDays)}`;
}

export function isValidReservationDuration(days: number): boolean {
  return Number.isInteger(days) && days >= RESERVATION_MIN_DAYS && days <= RESERVATION_MAX_DAYS;
}
