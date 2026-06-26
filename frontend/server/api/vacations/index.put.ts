import { requireVbiSession } from '../../utils/session';
import { writeVacations, type VacationStoreState } from '../../utils/vacationsStore';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  const body = await readBody<VacationStoreState>(event);
  if (!body || typeof body !== 'object' || !body.requestsByYear) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректное состояние отпусков' });
  }
  return writeVacations(body);
});
