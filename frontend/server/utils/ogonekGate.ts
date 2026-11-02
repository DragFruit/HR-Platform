/**
 * Серверный шлюз адвента: единственное место, где решается, открыто окно
 * или нет. Проверка даты не размазана по компонентам — клиент получает
 * уже посчитанные состояния и содержимое только открытых окон.
 */

import type { OgonekDayId, OgonekDayView } from '../../app/events/ogonek/types';
import {
  OGONEK_DAY_IDS,
  ogonekDayOpensAt,
  ogonekDayScheduleOpen,
  ogonekTodayDayId
} from '../../app/events/ogonek/timeline';
import { OGONEK_DAYS } from '../../app/events/ogonek/content';
import type { OgonekPlayer } from './ogonekStore';
import { getDeployAppEnv } from './appEnv';

/**
 * Отладочный режим: все 19 окон открыты сразу, декабрьское расписание и
 * очередь «сначала предыдущее» не действуют. Нужен, чтобы заказчик мог
 * пощупать весь адвент в ноябре.
 *
 * Снимается одним движением: `OGONEK_DEBUG_ALL_OPEN=0`. На бою режим
 * игнорируется всегда — там окна открывает только календарь.
 */
export function ogonekDebugAllOpen(): boolean {
  if (getDeployAppEnv() === 'production') return false;
  return String(process.env.OGONEK_DEBUG_ALL_OPEN ?? '1').trim() !== '0';
}

/**
 * Очередь догоняющего: окно N держит первое предыдущее неоткрытое окно.
 * Перескочить нельзя — на этом держатся связь окон 12 и 15 и накопление ёлки
 * (спека, раздел 4).
 */
export function blockingDay(player: OgonekPlayer, id: OgonekDayId): OgonekDayId | null {
  for (const prev of OGONEK_DAY_IDS) {
    if (prev >= id) break;
    if (!player.opened.includes(prev)) return prev;
  }
  return null;
}

/** Окно можно распечатать прямо сейчас. */
export function isDayOpenable(player: OgonekPlayer, id: OgonekDayId, now: Date): boolean {
  if (player.opened.includes(id)) return true;
  if (!ogonekDebugAllOpen() && !ogonekDayScheduleOpen(id, now)) return false;
  return blockingDay(player, id) === null;
}

/** Содержимое окна человеку уже доступно. */
export function isDayUnlocked(player: OgonekPlayer, id: OgonekDayId, now: Date): boolean {
  return player.opened.includes(id) && isDayOpenable(player, id, now);
}

/**
 * Окна для клиента. Нераспечатанное окно приезжает без текста и без подписи
 * «ждём данные» — снаружи видна только рамка и дата.
 */
export function buildDayViews(player: OgonekPlayer, now: Date): OgonekDayView[] {
  const todayId = ogonekTodayDayId(now);
  return OGONEK_DAYS.map((day) => {
    const scheduleOpen = ogonekDebugAllOpen() || ogonekDayScheduleOpen(day.id, now);
    const opened = player.opened.includes(day.id);
    const openable = isDayOpenable(player, day.id, now);
    return {
      id: day.id,
      dateIso: day.dateIso,
      weekday: day.weekday,
      title: day.title,
      object: day.object,
      kind: day.kind,
      scheduleOpen,
      opened,
      openable,
      today: todayId === day.id,
      opensAt: ogonekDayOpensAt(day.id),
      blockedBy: scheduleOpen && !opened ? blockingDay(player, day.id) : null,
      lead: opened ? day.lead : [],
      produces: opened ? day.produces : undefined,
      awaiting: opened ? day.awaiting : undefined,
      draft: opened ? day.draft : undefined
    };
  });
}

/** Действие окна N разрешено только если окно распечатано. */
export function requireUnlockedDay(player: OgonekPlayer, id: OgonekDayId, now: Date): void {
  if (!isDayUnlocked(player, id, now)) {
    throw createError({ statusCode: 403, statusMessage: `ogonek: окно ${id} ещё закрыто` });
  }
}
