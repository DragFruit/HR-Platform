import { requireVbiSession } from '../../utils/session';
import { readVacations } from '../../utils/vacationsStore';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  return readVacations();
});
