import { requireVbiSession } from '../../../utils/session';
import { setIdeaStatusForUser } from '../../../utils/ideaMutations';
import type { IdeaStatus } from '../../../../app/composables/useIdeasBank';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = String(getRouterParam(event, 'id') || '').trim();
  const body = await readBody<{ status?: IdeaStatus; comment?: string }>(event);
  const status = body?.status;
  if (
    status !== 'review' &&
    status !== 'implementation' &&
    status !== 'done' &&
    status !== 'rejected'
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный status' });
  }
  return setIdeaStatusForUser(session, id, status, body?.comment || '');
});
