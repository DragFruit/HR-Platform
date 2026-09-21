import { requireVbiSession } from '../../utils/session';
import { findEmployeeForSession } from '../../utils/employeesStore';
import { getVibePasswordPlain, hasVibePassword } from '../../utils/vibePasswordsStore';

/** Текущий логин Vibe (email) и пароль для показа себе (если есть seal). */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const emp = await findEmployeeForSession(session);
  if (!emp) {
    throw createError({ statusCode: 404, statusMessage: 'Сотрудник не найден в справочнике' });
  }
  const hasPassword = await hasVibePassword(emp.id);
  const password = hasPassword ? await getVibePasswordPlain(emp.id) : null;
  return {
    login: (emp.email || '').trim().toLowerCase(),
    has_password: hasPassword,
    /** Только себе; для старых записей без seal — null, пока не зададут пароль заново */
    password,
    employee_id: emp.id
  };
});
