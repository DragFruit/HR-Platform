import { requireVbiSession } from '../utils/session';
import { createIdeaForUser } from '../utils/ideaMutations';
import type { CreateIdeaInput } from '../../../app/composables/useIdeasBank';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<CreateIdeaInput>(event);
  return createIdeaForUser(session, body || ({} as CreateIdeaInput));
});
