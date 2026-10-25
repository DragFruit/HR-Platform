import { requireVbiSession } from '../../../utils/session';
import { nokturnNow } from '../../../utils/nokturnClock';
import {
  findOrCreatePlayer,
  mutateNokturn,
  NOKTURN_THREAD_LIMIT
} from '../../../utils/nokturnStore';
import { availableEvidenceIds } from '../../../utils/nokturnGate';
import type { NokturnBoard } from '../../../../app/events/nokturn/types';

const clamp01 = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
};

/**
 * Сохранение доски: позиции улик (доли 0..1), пины и нити.
 * Сервер режет лишнее — улики, которых у игрока ещё нет, и нити сверх лимита.
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ board?: NokturnBoard }>(event).catch(() => ({}));
  const incoming = body.board;
  if (!incoming || !Array.isArray(incoming.items) || !Array.isArray(incoming.threads)) {
    throw createError({ statusCode: 400, statusMessage: 'board required' });
  }

  const now = nokturnNow();

  return mutateNokturn((state) => {
    const player = findOrCreatePlayer(state, session.id, session.name || 'Сотрудник');
    const allowed = availableEvidenceIds(player, now);

    const items = incoming.items
      .filter((i) => i && typeof i.id === 'string' && allowed.has(i.id))
      .slice(0, 200)
      .map((i) => ({ id: i.id, x: clamp01(i.x), y: clamp01(i.y) }));

    const onBoard = new Set(items.map((i) => i.id));
    const seen = new Set<string>();
    const threads = incoming.threads
      .filter(
        (t) =>
          t &&
          typeof t.id === 'string' &&
          typeof t.from === 'string' &&
          typeof t.to === 'string' &&
          t.from !== t.to &&
          onBoard.has(t.from) &&
          onBoard.has(t.to)
      )
      .filter((t) => {
        // Одна нить на пару пинов, направление не важно.
        const key = [t.from, t.to].sort().join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, NOKTURN_THREAD_LIMIT)
      .map((t) => ({ id: t.id, from: t.from, to: t.to }));

    player.board = { items, threads };
    return { ok: true, board: player.board };
  });
});
