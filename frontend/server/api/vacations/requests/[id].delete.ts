import { requireVbiSession } from '../../../utils/session';
import { deleteVacationRequest } from '../../../utils/vacationRequestMutations';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id заявки' });
  }

  return deleteVacationRequest(id);
});
