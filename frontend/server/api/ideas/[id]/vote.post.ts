import { requireVbiSession } from '../../../utils/session';
import { voteIdeaForUser } from '../../../utils/ideaMutations';
import type { IdeaVoteDirection } from '../../../utils/ideasStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = String(getRouterParam(event, 'id') || '').trim();
  const body = await readBody<{ direction?: IdeaVoteDirection }>(event);
  const direction = body?.direction;
  if (direction !== 'up' && direction !== 'down') {
    throw createError({ statusCode: 400, statusMessage: 'Нужен direction: up | down' });
  }
  return voteIdeaForUser(session, id, direction);
});
