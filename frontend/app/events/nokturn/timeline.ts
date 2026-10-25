/**
 * Расписание квеста «Синий Ноктюрн». Все моменты — календарь Europe/Moscow.
 * Чистые функции без контента: файл импортируется и сервером, и страницей.
 */

import type { NokturnStageId } from './types';

export const NOKTURN_TZ = 'Europe/Moscow';

/** Этап N открывается в 10:00 МСК дня N и не раньше. */
export const NOKTURN_STAGE_DATES: Record<NokturnStageId, string> = {
  1: '2026-10-26',
  2: '2026-10-27',
  3: '2026-10-28',
  4: '2026-10-29',
  5: '2026-10-30'
};

/** Срок задержания: пятница 30 октября, 15:00 МСК. */
export const NOKTURN_DEADLINE_AT = '2026-10-30T15:00:00+03:00';

export const NOKTURN_STAGE_IDS: NokturnStageId[] = [1, 2, 3, 4, 5];

export function nokturnStageOpensAt(id: NokturnStageId): string {
  return `${NOKTURN_STAGE_DATES[id]}T10:00:00+03:00`;
}

/**
 * Конец окна полной ставки: 19:00 МСК, в пятницу — 15:00 (срок задержания).
 * После него этап ещё можно догнать, но уже за половину ставки.
 */
export function nokturnStageFullRateUntil(id: NokturnStageId): string {
  if (id === 5) return NOKTURN_DEADLINE_AT;
  return `${NOKTURN_STAGE_DATES[id]}T19:00:00+03:00`;
}

export function nokturnDeadlinePassed(now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(NOKTURN_DEADLINE_AT);
}

/** 10:00 дня N наступило. */
export function nokturnStageScheduleOpen(id: NokturnStageId, now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(nokturnStageOpensAt(id));
}

/** Голос в своё окно — полная ставка, догнанный задним числом — половина вверх. */
export function nokturnVoteIsLate(id: NokturnStageId, now: Date = new Date()): boolean {
  const ms = now.getTime();
  if (ms < Date.parse(nokturnStageOpensAt(id))) return true;
  return ms > Date.parse(nokturnStageFullRateUntil(id));
}

export function nokturnPointsFor(stake: number, late: boolean): number {
  return late ? Math.ceil(stake / 2) : stake;
}

/** «{чч:мм:сс}» для микротекстов. Отрицательный остаток — нули. */
export function formatNokturnCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Части счётчика срока задержания для микротекста «{N} дн {чч:мм}». */
export function nokturnDeadlineParts(ms: number): { days: number; hhmm: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { days, hhmm: `${pad(h)}:${pad(m)}` };
}
