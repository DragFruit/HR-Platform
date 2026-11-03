import type { H3Event } from 'h3';
import { getDeployAppEnv } from './appEnv';
import { OGONEK_DAY_DATES } from '../../app/events/ogonek/timeline';

/**
 * Часы адвента на один запрос: «сейчас», отладочный режим и выбранный
 * отладочный день. Гейт получает их одним объектом, а не читает env сам —
 * так проверка даты остаётся в одном месте и не расходится между ручками.
 */
export type OgonekClock = {
  now: Date;
  /** Все 19 окон открыты принудительно. */
  debugAllOpen: boolean;
  /** День, выбранный в панели отладки: окна живут по честному календарю этого дня. */
  devDay: number | null;
};

/** Cookie панели отладки: номер окна 1..19. На бою не читается. */
export const OGONEK_DEV_DAY_COOKIE = 'ogonek-dev-day';

/**
 * Отладочный режим: все 19 окон открыты сразу, расписание и очередь не
 * действуют. Нужен, чтобы заказчик мог пощупать весь адвент в ноябре.
 * Снимается одним движением: `OGONEK_DEBUG_ALL_OPEN=0`.
 */
function envDebugAllOpen(): boolean {
  return String(process.env.OGONEK_DEBUG_ALL_OPEN ?? '1').trim() !== '0';
}

function envNow(): Date {
  const raw = String(process.env.OGONEK_DEV_NOW || '').trim();
  if (raw) {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) return new Date(ms);
  }
  return new Date();
}

export function ogonekClock(event?: H3Event): OgonekClock {
  // На бою никаких сдвигов: реальное время, честный календарь.
  if (getDeployAppEnv() === 'production') {
    return { now: new Date(), debugAllOpen: false, devDay: null };
  }

  const raw = event ? Number(getCookie(event, OGONEK_DEV_DAY_COOKIE)) : NaN;
  const iso = Number.isInteger(raw) ? OGONEK_DAY_DATES[raw] : undefined;
  if (iso) {
    // Выбранный день — 11:00 МСК: окно этого дня уже открылось.
    return { now: new Date(`${iso}T11:00:00+03:00`), debugAllOpen: false, devDay: raw };
  }

  return { now: envNow(), debugAllOpen: envDebugAllOpen(), devDay: null };
}
