import { requireVbiSession } from '../../utils/session';
import { readEmployees } from '../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  requireVbiSession(event);
  return readEmployees();
});
