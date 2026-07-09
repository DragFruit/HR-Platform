import { requireVbiSession } from '../../../utils/session';
import { deleteVacationReservation } from '../../../utils/vacationReservationMutations';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id брони' });
  }

  return deleteVacationReservation(session, id);
});
