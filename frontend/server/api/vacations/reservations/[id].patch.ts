import { requireVbiSession } from '../../../utils/session';
import {
  patchVacationReservation,
  type PatchVacationReservationBody
} from '../../../utils/vacationReservationMutations';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id брони' });
  }

  const body = await readBody<PatchVacationReservationBody>(event);
  if (!body || (body.durationDays === undefined && body.comment === undefined)) {
    throw createError({ statusCode: 400, statusMessage: 'Нечего обновлять' });
  }

  return patchVacationReservation(session, id, body);
});
