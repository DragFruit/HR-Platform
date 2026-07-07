import { exchangeBitrixCode } from '../../../utils/bitrixClient';
import { loginSessionFromBitrix } from '../../../utils/bitrixAuth';
import { getOAuthReturnOrigin, getBitrixRedirectUri, isBitrixAuthConfigured } from '../../../utils/bitrixConfig';
import { setVbiSession } from '../../../utils/session';
import { bitrixOAuthStateCookieName } from '../../../utils/appEnv';

function redirectWithError(event: Parameters<typeof sendRedirect>[0], message: string) {
  const url = new URL('/', getOAuthReturnOrigin(event));
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
  const stateCookie = bitrixOAuthStateCookieName();
  const savedState = getCookie(event, stateCookie);
  deleteCookie(event, stateCookie, { path: '/' });

  if (!code) {
    return redirectWithError(event, 'Нет кода авторизации от Битрикс');
  }
  if (!state || !savedState || state !== savedState) {
    return redirectWithError(
      event,
      'Неверный state OAuth: Битрикс вернул на другой адрес, чем начали вход. ' +
        'Для localhost нужно отдельное локальное приложение в Битриксе (обработчик http://localhost:ПОРТ/api/auth/bitrix/callback) ' +
        'и свои CLIENT_ID/SECRET в frontend/.env — не те же, что на сервере 45.12.74.25.'
    );
  }

  try {
    const redirectUri = getBitrixRedirectUri(event);
    const token = await exchangeBitrixCode(code, redirectUri);
    const sessionUser = await loginSessionFromBitrix(token.access_token);
    setVbiSession(event, sessionUser);

    const url = new URL('/', getOAuthReturnOrigin(event));
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
