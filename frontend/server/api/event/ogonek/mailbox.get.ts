import { requireVbiSession } from '../../../utils/session';
import { ogonekClock } from '../../../utils/ogonekClock';
import { readOgonekState } from '../../../utils/ogonekStore';
import { ogonekMailboxOpen } from '../../../utils/ogonekGate';
import { demoThanks } from '../../../utils/ogonekDemo';

/** Порядок не по времени: по нему можно было бы вычислить, кто и когда писал. */
function stableHash(id: string): number {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Коробка с письмами. До 28 декабря и после 22 января письма не отдаются.
 * Отправителя в письме нет и в хранилище: его не знает никто.
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const clock = ogonekClock(event);
  if (!ogonekMailboxOpen(clock)) return { open: false, popup: false, letters: [] };

  const state = await readOgonekState();
  const player = state.players.find((p) => p.userId === session.id);
  const read = new Set(player?.thanksRead ?? []);
  const letters = [
    ...state.thanks.filter((t) => t.toUserId === session.id).map((t) => ({ id: t.id, text: t.text })),
    ...demoThanks()
  ]
    .sort((a, b) => stableHash(a.id) - stableHash(b.id))
    .map((l) => ({ ...l, read: read.has(l.id) }));

  return {
    open: true,
    // Кому писем нет, тому коробка не выскакивает: пустая обидела бы.
    popup: letters.length > (player?.mailboxSeenCount ?? 0),
    letters
  };
});
