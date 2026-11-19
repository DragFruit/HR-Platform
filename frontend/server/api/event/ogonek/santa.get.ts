import { requireVbiSession } from '../../../utils/session';
import { ogonekClock } from '../../../utils/ogonekClock';
import { ensureOgonekSantaDraw, readOgonekState } from '../../../utils/ogonekStore';
import { OGONEK_SANTA_UNTIL, ogonekSantaOpen } from '../../../../app/events/ogonek/timeline';
import { OGONEK_DAYS } from '../../../../app/events/ogonek/content';

const SANTA_DAY = OGONEK_DAYS.find((d) => d.kind === 'santa')!.id;

/**
 * Страница Тайного Санты. Пока регистрация открыта — формат, вишлист и
 * сколько записалось. После 11 декабря жеребьёвка делается сама при первом
 * запросе, и каждый видит только своё: кому дарит (классика) или свой номер
 * хода и общий порядок («Белый слон»). Кто дарит вам — не отдаём никогда.
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const clock = ogonekClock(event);
  const open = clock.debugAllOpen || ogonekSantaOpen(clock.now);
  let state = await readOgonekState();
  const me = state.players.find((p) => p.userId === session.id);
  const counts = {
    classic: state.players.filter((p) => p.santa === 'classic').length,
    elephant: state.players.filter((p) => p.santa === 'elephant').length
  };

  let draw: null | {
    classic: { name: string; department: string; wish: string } | null;
    classicTooFew: boolean;
    order: { name: string; department: string; mine: boolean }[];
  } = null;

  if (!open) {
    const d = await ensureOgonekSantaDraw();
    state = await readOgonekState();
    const byId = new Map(state.players.map((p) => [p.userId, p]));
    const recId = me?.santa === 'classic' ? d.pairs[String(session.id)] : undefined;
    const rec = recId ? byId.get(recId) : undefined;
    draw = {
      classic: rec ? { name: rec.name, department: rec.department, wish: rec.santaWish ?? '' } : null,
      classicTooFew: counts.classic < 2,
      order: d.order.map((id) => {
        const p = byId.get(id);
        return { name: p?.name ?? 'Участник', department: p?.department ?? '', mine: id === session.id };
      })
    };
  }

  return {
    open,
    until: OGONEK_SANTA_UNTIL,
    counts,
    format: me?.santa ?? '',
    wish: me?.santaWish ?? '',
    windowOpened: Boolean(me?.opened.includes(SANTA_DAY)),
    draw
  };
});
