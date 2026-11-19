import { requireRole } from '../../utils/requireRole';
import { readOgonekState } from '../../utils/ogonekStore';
import { ogonekClock } from '../../utils/ogonekClock';
import { OGONEK_SANTA_UNTIL, ogonekSantaOpen } from '../../../app/events/ogonek/timeline';

/**
 * Тайный Санта для админа: все участники с форматом и вишлистом, а после
 * жеребьёвки — кто кому Санта (классика) и порядок ходов («Белый слон»).
 * Только чтение. Жеребьёвку здесь не запускаем: её делает сама страница
 * Санты при первом запросе после закрытия регистрации.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin']);
  const state = await readOgonekState();
  const clock = ogonekClock(event);
  const byId = new Map(state.players.map((p) => [p.userId, p]));
  const person = (id: number) => {
    const p = byId.get(id);
    return { name: p?.name ?? 'Участник', department: p?.department ?? '' };
  };

  const participants = state.players
    .filter((p) => p.santa)
    .map((p) => ({ userId: p.userId, name: p.name, department: p.department, format: p.santa!, wish: p.santaWish ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const draw = state.santaDraw;
  return {
    open: clock.debugAllOpen || ogonekSantaOpen(clock.now),
    until: OGONEK_SANTA_UNTIL,
    counts: {
      classic: participants.filter((p) => p.format === 'classic').length,
      elephant: participants.filter((p) => p.format === 'elephant').length
    },
    participants,
    drawAt: draw?.at ?? null,
    pairs: draw
      ? Object.entries(draw.pairs).map(([giver, receiver]) => ({
          santa: person(Number(giver)),
          ward: { ...person(receiver), wish: byId.get(receiver)?.santaWish ?? '' }
        }))
      : [],
    order: draw ? draw.order.map((id, i) => ({ n: i + 1, ...person(id) })) : []
  };
});
