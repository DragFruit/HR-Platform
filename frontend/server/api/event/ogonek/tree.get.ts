import { requireVbiSession } from '../../../utils/session';
import { readOgonekState } from '../../../utils/ogonekStore';
import { demoToys } from '../../../utils/ogonekDemo';

/** Ёлка желаний: все игрушки с пожеланиями, подписанные. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const state = await readOgonekState();
  const toys = [...state.toys, ...demoToys()].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
  );
  const mine = state.toys.find((t) => t.userId === session.id) ?? null;
  return { toys, myToyId: mine?.id ?? null, count: toys.length };
});
