import { requireVbiSession } from '../../../../utils/session';
import { nokturnNow } from '../../../../utils/nokturnClock';
import { findOrCreatePlayer, mutateNokturn, nokturnStageProgress } from '../../../../utils/nokturnStore';
import { isStageOpen } from '../../../../utils/nokturnGate';
import { parseStageId } from '../../../../utils/nokturnRequest';
import { nokturnStageById } from '../../../../../app/events/nokturn/content';

/**
 * Мини-игра пройдена. Сервер сверяет найденное с картой улик этапа —
 * клиент не может объявить себя победителем, прислав пустой список.
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ stageId?: number; foundIds?: string[] }>(event).catch(() => ({}));
  const stageId = parseStageId(body.stageId);
  const found = Array.isArray(body.foundIds) ? body.foundIds.map(String) : [];
  const now = nokturnNow();

  const stage = nokturnStageById(stageId);
  const expected = (stage.minigame.hotspots ?? []).map((h) => h.evidenceId);

  if (expected.length) {
    const unique = new Set(found.filter((id) => expected.includes(id)));
    if (unique.size !== expected.length) {
      throw createError({ statusCode: 400, statusMessage: 'Найдены не все предметы' });
    }
  }

  return mutateNokturn((state) => {
    const player = findOrCreatePlayer(state, session.id, session.name || 'Сотрудник');
    if (!isStageOpen(player, stageId, now)) {
      throw createError({ statusCode: 403, statusMessage: 'Этап ещё не открыт' });
    }
    const progress = nokturnStageProgress(player, stageId);
    if (progress.attempts < 1) {
      throw createError({ statusCode: 409, statusMessage: 'Попытка не начата' });
    }
    if (!progress.released) {
      progress.releasedAt = new Date().toISOString();
    }
    progress.solved = true;
    progress.released = true;
    return { ok: true, solved: true };
  });
});
