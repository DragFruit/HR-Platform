import { requireVbiSession } from '../../utils/session';
import { findEmployeeForSession } from '../../utils/employeesStore';
import { hasVibePassword } from '../../utils/vibePasswordsStore';

/** Текущий логин Vibe (email) и есть ли пароль. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const emp = await findEmployeeForSession(session);
  if (!emp) {
    throw createError({ statusCode: 404, statusMessage: 'Сотрудник не найден в справочнике' });
  }
  return {
    login: (emp.email || '').trim().toLowerCase(),
    has_password: await hasVibePassword(emp.id),
    employee_id: emp.id
  };
});
