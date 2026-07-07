import { getBitrixConfig, getBitrixRedirectUri, isBitrixAuthConfigured, assertBitrixOAuthOrigin, assertStagingBitrixAppConfigured } from '../../utils/bitrixConfig';
import { bitrixOAuthStateCookieName } from '../../utils/appEnv';
import { createOAuthState } from '../../utils/oauthState';

export default defineEventHandler((event) => {
  if (!isBitrixAuthConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'Bitrix OAuth не настроен на сервере' });
  }

  const { bitrixPortalUrl, bitrixClientId, bitrixClientSecret } = getBitrixConfig();
  const state = createOAuthState(bitrixClientSecret);
  const redirectUri = getBitrixRedirectUri(event);
  assertStagingBitrixAppConfigured(event);
  assertBitrixOAuthOrigin(event, redirectUri);

  const stateCookie = bitrixOAuthStateCookieName();
  setCookie(event, stateCookie, state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600
  });

  const portal = bitrixPortalUrl.replace(/\/+$/, '');
  const url = new URL(`${portal}/oauth/authorize/`);
  url.searchParams.set('client_id', bitrixClientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  return sendRedirect(event, url.toString(), 302);
});
