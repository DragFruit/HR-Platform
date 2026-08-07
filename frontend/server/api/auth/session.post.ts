import { findCredential } from '../../utils/credentials';
import { getDeployAppEnv } from '../../utils/appEnv';
import { isAccessRevokedForIdentity } from '../../utils/employeeAccessDenylist';
import { setVbiSession } from '../../utils/session';

export default defineEventHandler(async (event) => {
  if (getDeployAppEnv() === 'production') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Демо-вход на боевом сервере отключён. Войдите через Битрикс24.'
    });
  }

  const body = await readBody<{ email?: string; password?: string }>(event);
  if (!body?.email || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите email и пароль' });
  }
  const user = findCredential(body.email, body.password);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Неверный логин или пароль' });
  }
  if (await isAccessRevokedForIdentity(user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Доступ закрыт: сотрудник удалён из справочника Vibe'
    });
  }
  setVbiSession(event, user);
  return { ok: true, user };
});
