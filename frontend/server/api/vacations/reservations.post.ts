import { requireVbiSession } from '../../utils/session';
import {
  createVacationReservation,
  type CreateVacationReservationBody
} from '../../utils/vacationReservationMutations';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<CreateVacationReservationBody>(event);

  if (!body || typeof body.year !== 'number' || typeof body.month !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'Некорректные данные брони' });
  }
  if (typeof body.durationDays !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'Укажите длительность' });
  }

  return createVacationReservation(session, body);
});
