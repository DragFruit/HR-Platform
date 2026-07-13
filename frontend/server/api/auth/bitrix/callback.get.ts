import { exchangeBitrixCode } from '../../../utils/bitrixClient';
import { loginSessionFromBitrix } from '../../../utils/bitrixAuth';
import { saveBitrixServiceOAuthFromLogin } from '../../../utils/bitrixOAuthServiceToken';
import {
  getBitrixConfig,
  getOAuthReturnOrigin,
  getBitrixRedirectUri,
  getRequestPublicOrigin,
  isBitrixAuthConfigured
} from '../../../utils/bitrixConfig';
import { setVbiSession } from '../../../utils/session';
import { bitrixOAuthStateCookieName } from '../../../utils/appEnv';
import { verifyOAuthState } from '../../../utils/oauthState';

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

  const { bitrixClientSecret } = getBitrixConfig();
  const stateValid =
    Boolean(state && savedState && state === savedState) ||
    verifyOAuthState(state, bitrixClientSecret);

  if (!stateValid) {
    const origin = getRequestPublicOrigin(event);
    const onProductionCallback = !origin.includes(':8080');
    const stagingHint =
      onProductionCallback
        ? ' Если открывали тест (:8080) — заходите на бой: http://45.12.74.25 (без :8080).'
        : '';
    return redirectWithError(
      event,
      'Неверный state OAuth — сессия входа устарела или сайт открыт не на том адресе.' +
        stagingHint +
        ' Очистите cookie для 45.12.74.25 и войдите снова. Для localhost — отдельное OAuth-приложение (docs/BITRIX.md).'
    );
  }

  try {
    const redirectUri = getBitrixRedirectUri(event);
    const token = await exchangeBitrixCode(code, redirectUri);
    const sessionUser = await loginSessionFromBitrix(token.access_token);
  if (sessionUser.role === 'admin' && token.refresh_token) {
    await saveBitrixServiceOAuthFromLogin(token, sessionUser.id);
  } else if (sessionUser.role === 'admin' && !token.refresh_token) {
    console.error(
      `[bitrixOAuthService] admin user ${sessionUser.id} вошёл через Bitrix, но refresh_token пуст — проверьте OAuth-приложение`
    );
  }
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
