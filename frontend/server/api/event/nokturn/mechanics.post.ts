import { requireVbiSession } from '../../../utils/session';
import { nokturnNow } from '../../../utils/nokturnClock';
import { findOrCreatePlayer, mutateNokturn, playerPoints } from '../../../utils/nokturnStore';
import { isStageOpen, NOKTURN_MECHANICS_CORRECT_OPTION } from '../../../utils/nokturnGate';
import { NOKTURN_MECHANICS_OPTIONS } from '../../../../app/events/nokturn/content';
import {
  nokturnDeadlinePassed,
  nokturnPointsFor,
  nokturnVoteIsLate
} from '../../../../app/events/nokturn/timeline';

/** Вопрос пятницы «как это было сделано»: +3 за верный вариант, один ответ. */
const MECHANICS_STAKE = 3;

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ optionId?: number }>(event).catch(() => ({}));
  const optionId = Number(body.optionId);
  if (!NOKTURN_MECHANICS_OPTIONS.some((o) => o.id === optionId)) {
    throw createError({ statusCode: 400, statusMessage: 'Неизвестный вариант' });
  }

  const now = nokturnNow();
  if (nokturnDeadlinePassed(now)) {
    throw createError({ statusCode: 403, statusMessage: 'Голосование закрыто' });
  }

  return mutateNokturn((state) => {
    const player = findOrCreatePlayer(state, session.id, session.name || 'Сотрудник');
    if (!isStageOpen(player, 5, now)) {
      throw createError({ statusCode: 403, statusMessage: 'Этап пятницы ещё не открыт' });
    }
    if (player.mechanics) {
      throw createError({
        statusCode: 409,
        statusMessage: 'На этом этапе решение уже вынесено'
      });
    }
    const late = nokturnVoteIsLate(5, now);
    const correct = optionId === NOKTURN_MECHANICS_CORRECT_OPTION;
    player.mechanics = {
      optionId,
      correct,
      points: correct ? nokturnPointsFor(MECHANICS_STAKE, late) : 0,
      late,
      at: new Date().toISOString()
    };
    return { ok: true, mechanics: player.mechanics, points: playerPoints(player) };
  });
});
