import { exchangeBitrixPassword } from '../../utils/bitrixClient';
import { loginSessionFromBitrix } from '../../utils/bitrixAuth';
import { isBitrixAuthConfigured } from '../../utils/bitrixConfig';
import { setVbiSession } from '../../utils/session';

/**
 * Вход логин/пароль Bitrix → сессия Vibe (cookie на нашей стороне).
 * Без PHP и без правок на портале: только /oauth/token/ grant_type=password.
 */
export default defineEventHandler(async (event) => {
  if (!isBitrixAuthConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'Bitrix OAuth не настроен' });
  }

  const body = await readBody<{ login?: string; password?: string; email?: string }>(event);
  const login = String(body?.login || body?.email || '').trim();
  const password = String(body?.password || '');
  if (!login || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите логин и пароль' });
  }

  const tokens = await exchangeBitrixPassword(login, password);
  const user = await loginSessionFromBitrix(tokens.access_token);
  setVbiSession(event, user);
  return { ok: true, user };
});
