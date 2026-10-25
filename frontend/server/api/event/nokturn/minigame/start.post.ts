import { requireVbiSession } from '../../../../utils/session';
import { nokturnNow } from '../../../../utils/nokturnClock';
import {
  findOrCreatePlayer,
  mutateNokturn,
  nokturnStageProgress,
  NOKTURN_MINIGAME_ATTEMPTS
} from '../../../../utils/nokturnStore';
import { blockingStage, isStageOpen } from '../../../../utils/nokturnGate';
import { parseStageId } from '../../../../utils/nokturnRequest';

/** Запуск попытки мини-игры. Счётчик попыток — на сервере. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ stageId?: number }>(event).catch(() => ({}));
  const stageId = parseStageId(body.stageId);
  const now = nokturnNow();

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
    if (progress.released) {
      return { ok: true, already: true, attempts: progress.attempts, attemptsLeft: 0 };
    }
    if (progress.attempts >= NOKTURN_MINIGAME_ATTEMPTS) {
      // Страховка: попытки кончились, но улики почему-то не выданы.
      progress.released = true;
      progress.releasedAt = new Date().toISOString();
      return { ok: true, released: true, attempts: progress.attempts, attemptsLeft: 0 };
    }
    progress.attempts += 1;
    return {
      ok: true,
      attempts: progress.attempts,
      attemptsLeft: NOKTURN_MINIGAME_ATTEMPTS - progress.attempts
    };
  });
});
