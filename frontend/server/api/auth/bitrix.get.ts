import { randomBytes } from 'node:crypto';
import { getBitrixConfig, getBitrixRedirectUri, isBitrixAuthConfigured, assertBitrixOAuthOrigin } from '../../utils/bitrixConfig';

const STATE_COOKIE = 'bitrix-oauth-state';

export default defineEventHandler((event) => {
  if (!isBitrixAuthConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'Bitrix OAuth не настроен на сервере' });
  }

  const { bitrixPortalUrl, bitrixClientId } = getBitrixConfig();
  const state = randomBytes(16).toString('hex');
  const redirectUri = getBitrixRedirectUri(event);
  assertBitrixOAuthOrigin(event, redirectUri);

  setCookie(event, STATE_COOKIE, state, {
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
