import { authRoleFromAccountRole } from '../../utils/bitrixSync';
import type { SessionUser } from '../../utils/credentials';
import { isAccessRevokedForIdentity } from '../../utils/employeeAccessDenylist';
import { readEmployees, type ServerEmployee } from '../../utils/employeesStore';
import { setVbiSession } from '../../utils/session';
import { checkVibePassword, ensureVibePasswordSeal } from '../../utils/vibePasswordsStore';
import { findEmployeeByVibeLogin } from '../../utils/vibeLogin';

function sessionUserId(emp: ServerEmployee): number {
  const bitrix = Number(emp.bitrix_user_id || emp.platform_user_id || emp.id);
  return Number.isFinite(bitrix) && bitrix > 0 ? bitrix : emp.id;
}

/**
 * Вход по паролю Vibe (локальный хеш в server/data/vibe-passwords.json).
 * Bitrix не вызываем — правок портала не нужно.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ login?: string; email?: string; password?: string }>(event);
  const login = String(body?.login || body?.email || '').trim();
  const password = String(body?.password || '');
  if (!login || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите логин и пароль' });
  }

  const employees = await readEmployees();
  const emp = findEmployeeByVibeLogin(employees, login);
  if (!emp) {
    throw createError({ statusCode: 401, statusMessage: 'Неверный логин или пароль' });
  }

  const ok = await checkVibePassword(emp.id, password);
  if (!ok) {
    throw createError({
      statusCode: 401,
      statusMessage:
        'Неверный логин или пароль. Если пароля ещё нет — HR задаёт его в Админ → Сотрудники.'
    });
  }

  // Старые записи без seal — дописать при успешном входе, чтобы глаз в профиле открывал текст
  await ensureVibePasswordSeal(emp.id, password, { actorEmployeeId: emp.id }).catch(() => {});

  const userId = sessionUserId(emp);
  const email = String(emp.email || '').trim().toLowerCase();
  if (!email) {
    throw createError({
      statusCode: 403,
      statusMessage: 'У сотрудника в справочнике нет email — вход по паролю недоступен'
    });
  }

  const role = authRoleFromAccountRole(emp.account_role) || 'employee';
  const user: SessionUser = {
    id: userId,
    bitrix_user_id: emp.bitrix_user_id ?? userId,
    name: emp.name,
    email,
    role,
    department: emp.department || '',
    auth_source: 'vibe'
  };

  if (await isAccessRevokedForIdentity(user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Доступ закрыт: сотрудник удалён из справочника Vibe'
    });
  }

  setVbiSession(event, user);
  return { ok: true, user };
});
