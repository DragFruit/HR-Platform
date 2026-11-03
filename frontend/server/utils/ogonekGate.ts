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
import type { OgonekClock } from './ogonekClock';


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
export function isDayOpenable(player: OgonekPlayer, id: OgonekDayId, clock: OgonekClock): boolean {
  if (player.opened.includes(id)) return true;
  if (clock.debugAllOpen) return true;
  if (!ogonekDayScheduleOpen(id, clock.now)) return false;
  return blockingDay(player, id) === null;
}

/** Содержимое окна человеку уже доступно. */
export function isDayUnlocked(player: OgonekPlayer, id: OgonekDayId, clock: OgonekClock): boolean {
  return player.opened.includes(id) && isDayOpenable(player, id, clock);
}

/**
 * Окна для клиента. Нераспечатанное окно приезжает без текста и без подписи
 * «ждём данные» — снаружи видна только рамка и дата.
 */
export function buildDayViews(player: OgonekPlayer, clock: OgonekClock): OgonekDayView[] {
  const todayId = ogonekTodayDayId(clock.now);
  return OGONEK_DAYS.map((day) => {
    const scheduleOpen = clock.debugAllOpen || ogonekDayScheduleOpen(day.id, clock.now);
    const opened = player.opened.includes(day.id);
    const openable = isDayOpenable(player, day.id, clock);
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
      done: player.done.includes(day.id),
      // Пропущено: день уже прошёл, а листок так и не оторван.
      missed: !opened && scheduleOpen && !clock.debugAllOpen && todayId !== day.id,
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
export function requireUnlockedDay(player: OgonekPlayer, id: OgonekDayId, clock: OgonekClock): void {
  if (!isDayUnlocked(player, id, clock)) {
    throw createError({ statusCode: 403, statusMessage: `ogonek: окно ${id} ещё закрыто` });
  }
}
