import { requireVbiSession, setVbiSession } from '../../utils/session';
import { findEmployeeForSession, patchEmployeeEmail } from '../../utils/employeesStore';
import { hasVibePassword, setVibePassword } from '../../utils/vibePasswordsStore';

/**
 * Сотрудник сам задаёт логин (email в справочнике) и пароль Vibe.
 * Дальше вход — «Войти» на экране логина, без Битрикса.
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const emp = await findEmployeeForSession(session);
  if (!emp) {
    throw createError({ statusCode: 404, statusMessage: 'Сотрудник не найден в справочнике' });
  }

  const body = await readBody<{ login?: string; password?: string }>(event);
  const login = String(body?.login || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (!login || !login.includes('@')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Укажите корректный email — он будет логином для входа'
    });
  }

  const hadPassword = await hasVibePassword(emp.id);
  if (!password && !hadPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Задайте пароль не короче 8 символов'
    });
  }
  if (password && password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Пароль не короче 8 символов' });
  }

  const updated =
    login !== (emp.email || '').trim().toLowerCase()
      ? await patchEmployeeEmail(emp.id, login, { actorEmployeeId: emp.id })
      : emp;

  if (password) {
    await setVibePassword(emp.id, password, { actorEmployeeId: emp.id, reason: 'self-vibe-password-set' });
  }

  const nextUser = {
    ...session,
    email: (updated.email || login).trim().toLowerCase()
  };
  setVbiSession(event, nextUser);

  return {
    ok: true,
    login: nextUser.email,
    has_password: await hasVibePassword(emp.id),
    user: nextUser
  };
});
