import { requireVbiSession } from '../../utils/session';
import { readEmployees } from '../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  return readEmployees();
});
