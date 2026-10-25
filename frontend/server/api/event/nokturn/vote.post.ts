import { requireVbiSession } from '../../../utils/session';
import { nokturnNow } from '../../../utils/nokturnClock';
import {
  findOrCreatePlayer,
  mutateNokturn,
  playerPoints,
  nokturnStageProgress
} from '../../../utils/nokturnStore';
import { blockingStage, isStageOpen, NOKTURN_CULPRIT } from '../../../utils/nokturnGate';
import { parseStageId } from '../../../utils/nokturnRequest';
import type { NokturnSuspectId } from '../../../../app/events/nokturn/types';
import { nokturnStageById, NOKTURN_SUSPECTS } from '../../../../app/events/nokturn/content';
import {
  nokturnDeadlinePassed,
  nokturnPointsFor,
  nokturnVoteIsLate
} from '../../../../app/events/nokturn/timeline';

/**
 * Решение по этапу: один выбор, изменить нельзя. Баллы считает сервер:
 * полная ставка в своё окно, половина с округлением вверх — за догнанный этап.
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ stageId?: number; suspectId?: string }>(event).catch(() => ({}));
  const stageId = parseStageId(body.stageId);
  const suspectId = String(body.suspectId || '');
  if (!NOKTURN_SUSPECTS.some((s) => s.id === suspectId)) {
    throw createError({ statusCode: 400, statusMessage: 'Неизвестный подозреваемый' });
  }

  const now = nokturnNow();
  if (nokturnDeadlinePassed(now)) {
    throw createError({ statusCode: 403, statusMessage: 'Голосование закрыто' });
  }

  return mutateNokturn((state) => {
    const player = findOrCreatePlayer(state, session.id, session.name || 'Сотрудник');

    if (!isStageOpen(player, stageId, now)) {
      const blocked = blockingStage(player, stageId);
      throw createError({
        statusCode: 403,
        statusMessage: blocked
          ? `Сначала вынесите решение по этапу ${blocked}`
          : 'Этап ещё не открыт'
      });
    }

    const progress = nokturnStageProgress(player, stageId);
    if (progress.vote) {
      throw createError({
        statusCode: 409,
        statusMessage: 'На этом этапе решение уже вынесено'
      });
    }

    const late = nokturnVoteIsLate(stageId, now);
    const stake = nokturnStageById(stageId).stake;
    const points = suspectId === NOKTURN_CULPRIT ? nokturnPointsFor(stake, late) : 0;

    progress.vote = {
      suspectId: suspectId as NokturnSuspectId,
      at: new Date().toISOString(),
      points,
      late
    };

    return {
      ok: true,
      vote: progress.vote,
      points: playerPoints(player)
    };
  });
});
