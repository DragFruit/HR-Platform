import { exchangeBitrixCode } from '../../../utils/bitrixClient';
import { loginSessionFromBitrix } from '../../../utils/bitrixAuth';
import { getAppPublicOrigin, getBitrixRedirectUri, isBitrixAuthConfigured } from '../../../utils/bitrixConfig';
import { setVbiSession } from '../../../utils/session';

const STATE_COOKIE = 'bitrix-oauth-state';

function redirectWithError(event: Parameters<typeof sendRedirect>[0], message: string) {
  const url = new URL('/', getAppPublicOrigin(event));
  url.searchParams.set('auth_error', message);
  return sendRedirect(event, url.toString());
}

export default defineEventHandler(async (event) => {
  if (!isBitrixAuthConfigured()) {
    return redirectWithError(event, 'Bitrix OAuth не настроен');
  }

  const query = getQuery(event);
  const error = String(query.error || '');
  if (error) {
    const description = String(query.error_description || error);
    return redirectWithError(event, description);
  }

  const code = String(query.code || '');
  const state = String(query.state || '');
  const savedState = getCookie(event, STATE_COOKIE);
  deleteCookie(event, STATE_COOKIE, { path: '/' });

  if (!code) {
    return redirectWithError(event, 'Нет кода авторизации от Битрикс');
  }
  if (!state || !savedState || state !== savedState) {
    return redirectWithError(event, 'Неверный state OAuth');
  }

  try {
    const redirectUri = getBitrixRedirectUri(event);
    const token = await exchangeBitrixCode(code, redirectUri);
    const sessionUser = await loginSessionFromBitrix(token.access_token);
    setVbiSession(event, sessionUser);

    const url = new URL('/', getAppPublicOrigin(event));
    url.searchParams.set('auth', 'bitrix');
    return sendRedirect(event, url.toString());
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'statusMessage' in err
        ? String((err as { statusMessage?: string }).statusMessage)
        : 'Ошибка входа через Битрикс';
    return redirectWithError(event, message);
  }
});
