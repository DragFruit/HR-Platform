import { requireVbiSession } from '../../../utils/session';
import { ogonekClock } from '../../../utils/ogonekClock';
import { readOgonekState } from '../../../utils/ogonekStore';
import { demoFeed } from '../../../utils/ogonekDemo';

/** Живая лента: кто что сделал только что. «Спасибо» приходит без имени. */
export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  const { now } = ogonekClock(event);
  const state = await readOgonekState();
  const feed = [...state.feed, ...demoFeed(now)]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 30);
  return { feed, serverNow: now.toISOString() };
});
