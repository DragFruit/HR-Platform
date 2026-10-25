import { requireVbiSession } from '../../../../utils/session';
import { nokturnNow } from '../../../../utils/nokturnClock';
import {
  findOrCreatePlayer,
  mutateNokturn,
  nokturnStageProgress,
  NOKTURN_MINIGAME_ATTEMPTS
} from '../../../../utils/nokturnStore';
import { isStageOpen } from '../../../../utils/nokturnGate';
import { parseStageId } from '../../../../utils/nokturnRequest';

/**
 * Попытка провалена. Улика скиллом не блокируется: после третьей неудачи
 * пакет выдаётся всё равно, но без зачёта мини-игры.
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ stageId?: number }>(event).catch(() => ({}));
  const stageId = parseStageId(body.stageId);
  const now = nokturnNow();

  return mutateNokturn((state) => {
    const player = findOrCreatePlayer(state, session.id, session.name || 'Сотрудник');
    if (!isStageOpen(player, stageId, now)) {
      throw createError({ statusCode: 403, statusMessage: 'Этап ещё не открыт' });
    }
    const progress = nokturnStageProgress(player, stageId);
    if (progress.released) {
      return { ok: true, released: true, attemptsLeft: 0 };
    }
    const attemptsLeft = Math.max(0, NOKTURN_MINIGAME_ATTEMPTS - progress.attempts);
    if (attemptsLeft === 0) {
      progress.released = true;
      progress.releasedAt = new Date().toISOString();
      return { ok: true, released: true, attemptsLeft: 0 };
    }
    return { ok: true, released: false, attemptsLeft };
  });
});
