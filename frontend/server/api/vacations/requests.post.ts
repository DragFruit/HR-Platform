import { requireVbiSession } from '../../utils/session';
import {
  createVacationRequest,
  type CreateVacationRequestBody
} from '../../utils/vacationRequestMutations';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  const body = await readBody<CreateVacationRequestBody>(event);

  if (
    !body ||
    typeof body.year !== 'number' ||
    !body.employee?.trim() ||
    !body.start ||
    !body.end
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректные данные заявки' });
  }
  if (body.end < body.start) {
    throw createError({ statusCode: 400, statusMessage: 'Дата окончания раньше начала' });
  }

  return createVacationRequest(body);
});
