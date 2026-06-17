import { requireRole } from '../../utils/requireRole';
import { writeEmployees, type ServerEmployee } from '../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  requireRole(event, ['admin', 'hr']);
  const body = await readBody<ServerEmployee[]>(event);
  if (!Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Ожидается массив сотрудников' });
  }
  return writeEmployees(body);
});
