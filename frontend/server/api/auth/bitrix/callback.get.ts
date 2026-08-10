import { exchangeBitrixCode } from '../../../utils/bitrixClient';
import { loginSessionFromBitrix } from '../../../utils/bitrixAuth';
import { saveBitrixServiceOAuthFromLogin } from '../../../utils/bitrixOAuthServiceToken';
import {
  getBitrixConfig,
  getCanonicalAppOrigin,
  getBitrixRedirectUri,
  getRequestPublicOrigin,
  isBitrixAuthConfigured
} from '../../../utils/bitrixConfig';
import { createOAuthLoginTicket } from '../../../utils/oauthLoginTicket';
import { bitrixOAuthStateCookieName } from '../../../utils/appEnv';
import { verifyOAuthState } from '../../../utils/oauthState';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

function authDebugLog(line: string) {
  try {
    const file = join(process.cwd(), 'server/data/auth-callback.log');
    appendFileSync(file, `${new Date().toISOString()} ${line}\n`, 'utf8');
  } catch {
    /* ignore */
  }
}

function redirectWithError(event: Parameters<typeof sendRedirect>[0], message: string) {
  const origin = getCanonicalAppOrigin(event);
  const url = new URL('/', origin);
  url.searchParams.set('auth_error', message);
  setHeader(event, 'cache-control', 'no-store, no-cache, must-revalidate');
  authDebugLog(`ERR_REDIRECT ${message.slice(0, 80)}`);
  // Абсолютный URL: callback часто на :8080, бой на :80.
  return sendRedirect(event, url.toString());
}

/**
 * После Bitrix (HTTPS→HTTP) Set-Cookie на 302/meta-refresh в той же цепочке Chrome отбрасывает.
 * 200 HTML разрывает цепочку; form POST — first-party навигация, cookie садится.
 * Без meta refresh: он снова склеивается с cross-site redirect chain.
 *
 * action формы — относительный `/api/auth/bitrix-ticket`: CSP `form-action 'self'`
 * запрещает POST с :8080 на :80 (разные origin). Ticket затем редиректит на APP_PUBLIC_URL.
 */
function renderLoginHandoffHtml(ticket: string) {
  const safeTicket = ticket
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Вход в VIBE VBI…</title>
  <style>
    body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#eeeee8;color:#111}
    p{font-size:1rem}
  </style>
</head>
<body>
  <p>Завершаем вход через Битрикс24…</p>
  <form id="vbi-handoff" method="POST" action="/api/auth/bitrix-ticket" accept-charset="utf-8">
    <input type="hidden" name="ticket" value="${safeTicket}" />
  </form>
  <script>
(function () {
  setTimeout(function () {
    document.getElementById("vbi-handoff").submit();
  }, 0);
})();
  </script>
</body>
</html>`;
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store, no-cache, must-revalidate');
  setHeader(event, 'pragma', 'no-cache');
  setHeader(event, 'x-vbi-auth', 'callback-v9');

  if (!isBitrixAuthConfigured()) {
    return redirectWithError(event, 'Bitrix OAuth не настроен');
  }

  const query = getQuery(event);

  // Внутренний E2E без Bitrix (секретный ключ, не для браузера).
  if (String(query.force_handoff || '') === '1' && String(query.force_key || '') === 'vbi-e2e') {
    const user = {
      id: 578,
      bitrix_user_id: 578,
      name: 'Probe',
      email: 'ast@vbi.ru',
      role: 'manager' as const,
      department: 'SEO / ORM',
      auth_source: 'bitrix' as const
    };
    const ticket = createOAuthLoginTicket(user);
    authDebugLog(`FORCE_HANDOFF ticketLen=${ticket.length}`);
    setHeader(event, 'content-type', 'text/html; charset=utf-8');
    setHeader(event, 'x-vbi-auth', 'handoff-v9-force');
    return renderLoginHandoffHtml(ticket);
  }

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

  authDebugLog(
    `HIT code=${Boolean(code)} state=${Boolean(state)} cookieState=${Boolean(savedState)}`
  );

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

    const canSaveServiceToken =
      sessionUser.role === 'admin' || sessionUser.role === 'hr';
    if (canSaveServiceToken && token.refresh_token) {
      await saveBitrixServiceOAuthFromLogin(token, sessionUser.id);
    } else if (canSaveServiceToken && !token.refresh_token) {
      console.error(
        `[bitrixOAuthService] ${sessionUser.role} user ${sessionUser.id} вошёл через Bitrix, но refresh_token пуст — проверьте OAuth-приложение`
      );
    }

    const ticket = createOAuthLoginTicket(sessionUser);
    authDebugLog(`HANDOFF200 user=${sessionUser.id} ticketLen=${ticket.length}`);
    console.info('[bitrix/callback] V9 handoff200', sessionUser.id, ticket.length);
    setHeader(event, 'content-type', 'text/html; charset=utf-8');
    setHeader(event, 'x-vbi-auth', 'handoff-v9');
    return renderLoginHandoffHtml(ticket);
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'statusMessage' in err
        ? String((err as { statusMessage?: string }).statusMessage)
        : 'Ошибка входа через Битрикс';
    authDebugLog(`CATCH ${message.slice(0, 120)}`);
    console.info('[bitrix/callback] V9 catch', message.slice(0, 160));
    return redirectWithError(event, message);
  }
});
