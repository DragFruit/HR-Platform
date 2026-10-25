import { requireVbiSession } from '../../../../utils/session';
import { nokturnNow } from '../../../../utils/nokturnClock';
import { findOrCreatePlayer, mutateNokturn, nokturnStageProgress } from '../../../../utils/nokturnStore';
import { isStageOpen } from '../../../../utils/nokturnGate';
import { parseStageId } from '../../../../utils/nokturnRequest';
import { nokturnStageById } from '../../../../../app/events/nokturn/content';

/**
 * Выдача улик этапа без мини-игры: игры вторника-пятницы ещё не собраны,
 * а улика скиллом не блокируется никогда (раздел 4 спеки). Баллы за мини-игру
 * не начисляются и здесь — `solved` остаётся false.
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ stageId?: number }>(event).catch(() => ({}));
  const stageId = parseStageId(body.stageId);
  const now = nokturnNow();

  if (nokturnStageById(stageId).minigame.kind === 'search') {
    throw createError({ statusCode: 400, statusMessage: 'У этапа есть мини-игра' });
  }

  return mutateNokturn((state) => {
    const player = findOrCreatePlayer(state, session.id, session.name || 'Сотрудник');
    if (!isStageOpen(player, stageId, now)) {
      throw createError({ statusCode: 403, statusMessage: 'Этап ещё не открыт' });
    }
    const progress = nokturnStageProgress(player, stageId);
    if (!progress.released) {
      progress.released = true;
      progress.releasedAt = new Date().toISOString();
    }
    return { ok: true, released: true };
  });
});
