import { requireVbiSession } from '../../utils/session';
import { readVacations, writeVacations, type VacationStoreState } from '../../utils/vacationsStore';
import { syncApprovedVacationsToBitrix } from '../../utils/bitrixVacationAbsence';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  const body = await readBody<VacationStoreState>(event);
  if (!body || typeof body !== 'object' || !body.requestsByYear) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректное состояние отпусков' });
  }

  const previous = await readVacations();
  const synced = await syncApprovedVacationsToBitrix(previous, body);
  return writeVacations(synced);
});
