/**
 * Расписание адвента «Огонёк 2027». Все моменты — календарь Europe/Moscow.
 * Чистые функции без контента: файл импортируется и сервером, и страницей.
 *
 * 19 окон по рабочим дням с вторника 1 декабря по пятницу 25 декабря 2026.
 * 16 и 17 декабря в российском календаре рабочие (спека, шапка документа).
 */

import type { OgonekDayId } from './types';

export const OGONEK_TZ = 'Europe/Moscow';

/** Окно N открывается в 10:00 МСК своего дня и не раньше. */
export const OGONEK_DAY_DATES: Record<OgonekDayId, string> = {
  1: '2026-12-01',
  2: '2026-12-02',
  3: '2026-12-03',
  4: '2026-12-04',
  5: '2026-12-07',
  6: '2026-12-08',
  7: '2026-12-09',
  8: '2026-12-10',
  9: '2026-12-11',
  10: '2026-12-14',
  11: '2026-12-15',
  12: '2026-12-16',
  13: '2026-12-17',
  14: '2026-12-18',
  15: '2026-12-21',
  16: '2026-12-22',
  17: '2026-12-23',
  18: '2026-12-24',
  19: '2026-12-25'
};

export const OGONEK_DAY_IDS: OgonekDayId[] = Array.from({ length: 19 }, (_, i) => i + 1);

/** Сам Огонёк: пятница 25 декабря, 18:00 МСК. */
export const OGONEK_PARTY_AT = '2026-12-25T18:00:00+03:00';

/** Письма из окна 16 возвращаются через полгода. */
export const OGONEK_LETTER_DELIVERY_AT = '2027-06-30T10:00:00+03:00';

export function ogonekDayOpensAt(id: OgonekDayId): string {
  return `${OGONEK_DAY_DATES[id]}T10:00:00+03:00`;
}

/** 10:00 дня N наступило. */
export function ogonekDayScheduleOpen(id: OgonekDayId, now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(ogonekDayOpensAt(id));
}

/** Календарный день МСК в виде `YYYY-MM-DD`. */
export function ogonekMoscowDateIso(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OGONEK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

/** Окно сегодняшнего дня — его медальон светится отдельно от прочих открытых. */
export function ogonekTodayDayId(now: Date = new Date()): OgonekDayId | null {
  const today = ogonekMoscowDateIso(now);
  const found = OGONEK_DAY_IDS.find((id) => OGONEK_DAY_DATES[id] === today);
  return found ?? null;
}

/** «{N} дн {чч:мм}» для счётчика до Огонька. */
export function ogonekCountdownParts(ms: number): { days: number; hhmm: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { days, hhmm: `${pad(h)}:${pad(m)}` };
}

export function formatOgonekDate(dateIso: string): string {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  const [, m, d] = dateIso.split('-');
  return `${Number(d)} ${months[Number(m) - 1]}`;
}
