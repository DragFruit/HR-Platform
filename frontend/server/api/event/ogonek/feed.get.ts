import { requireVbiSession } from '../../../utils/session';
import { ogonekClock } from '../../../utils/ogonekClock';
import { readOgonekState } from '../../../utils/ogonekStore';
import { demoFeed } from '../../../utils/ogonekDemo';

/**
 * Кто сейчас на странице адвента: страница опрашивает ленту каждые
 * несколько секунд, так что «был в последние 30 с» = смотрит прямо сейчас.
 * Живёт в памяти процесса: после рестарта счётчик набирается заново за 30 с.
 */
const ONLINE_WINDOW_MS = 30_000;
const seen = new Map<number, number>();

function touchOnline(userId: number): number {
  const t = Date.now();
  seen.set(userId, t);
  for (const [id, at] of seen) if (t - at > ONLINE_WINDOW_MS) seen.delete(id);
  return seen.size;
}

/** Живая лента: кто что сделал только что. «Спасибо» приходит без имени. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const online = touchOnline(session.id);
  const { now } = ogonekClock(event);
  const state = await readOgonekState();
  const feed = [...state.feed, ...demoFeed(now)]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 30);
  return { feed, online, serverNow: now.toISOString() };
});
