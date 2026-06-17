import { findCredential } from '../../utils/credentials';
import { setVbiSession } from '../../utils/session';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; password?: string }>(event);
  if (!body?.email || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите email и пароль' });
  }
  const user = findCredential(body.email, body.password);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Неверный логин или пароль' });
  }
  setVbiSession(event, user);
  return { ok: true, user };
});
