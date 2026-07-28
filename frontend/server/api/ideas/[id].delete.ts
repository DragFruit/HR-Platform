import { requireVbiSession } from '../../utils/session';
import { deleteIdeaForUser } from '../../utils/ideaMutations';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = String(getRouterParam(event, 'id') || '').trim();
  return deleteIdeaForUser(session, id);
});
