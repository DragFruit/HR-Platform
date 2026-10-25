import { requireVbiSession } from '../../../utils/session';
import { nokturnNow } from '../../../utils/nokturnClock';
import { emptyNokturnPlayer, readNokturnPlayers } from '../../../utils/nokturnStore';
import { buildStageViews } from '../../../utils/nokturnGate';

/** Точка на пункте меню: есть этап, который можно открыть прямо сейчас. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const now = nokturnNow();
  const players = await readNokturnPlayers();
  const player =
    players.find((p) => p.userId === session.id) ??
    emptyNokturnPlayer(session.id, session.name || 'Сотрудник');

  const dot = buildStageViews(player, now).some(
    (s) => s.minigame.state === 'available' || s.minigame.state === 'catch-up' || (s.open && !s.vote)
  );
  return { dot };
});
