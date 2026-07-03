import { requireVbiSession } from '../../utils/session';
import {
  patchVacationRequest,
  type PatchVacationRequestBody
} from '../../utils/vacationRequestMutations';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id заявки' });
  }

  const body = await readBody<PatchVacationRequestBody>(event);
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Некорректное тело запроса' });
  }
  if (body.start !== undefined && body.end !== undefined && body.end < body.start) {
    throw createError({ statusCode: 400, statusMessage: 'Дата окончания раньше начала' });
  }

  return patchVacationRequest(id, body);
});
