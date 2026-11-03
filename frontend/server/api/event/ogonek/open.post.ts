import { requireVbiSession } from '../../../utils/session';
import { ogonekClock } from '../../../utils/ogonekClock';
import { findOrCreateOgonekPlayer, mutateOgonek, pushOgonekFeed } from '../../../utils/ogonekStore';
import { blockingDay, buildDayViews, isDayOpenable } from '../../../utils/ogonekGate';
import { ogonekRankFor } from '../../../../app/events/ogonek/content';

/** Распечатать окно N. Решение «можно или нет» принимает только сервер. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ dayId?: number }>(event).catch(() => ({}) as { dayId?: number });
  const dayId = Number(body.dayId);
  if (!Number.isInteger(dayId) || dayId < 1 || dayId > 19) {
    throw createError({ statusCode: 400, statusMessage: 'dayId 1..19 required' });
  }
  const clock = ogonekClock(event);

  return mutateOgonek((state) => {
    const player = findOrCreateOgonekPlayer(
      state,
      session.id,
      session.name || 'Сотрудник',
      session.department || ''
    );
    if (!player.opened.includes(dayId)) {
      if (!isDayOpenable(player, dayId, clock)) {
        const blocker = blockingDay(player, dayId);
        throw createError({
          statusCode: 403,
          statusMessage: blocker
            ? `Сначала окно ${blocker}`
            : 'Окно ещё не открылось'
        });
      }
      player.opened = [...player.opened, dayId].sort((a, b) => a - b);
      pushOgonekFeed(state, 'window', `окно ${dayId} открыто`, {
        name: player.name,
        department: player.department
      });
    }
    return {
      ok: true,
      opened: player.opened,
      rank: ogonekRankFor(player.opened.length),
      days: buildDayViews(player, clock)
    };
  });
});
