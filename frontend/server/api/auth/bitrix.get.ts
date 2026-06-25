import { randomBytes } from 'node:crypto';
import { getBitrixRedirectUri, isBitrixAuthConfigured } from '../../utils/bitrixConfig';

const STATE_COOKIE = 'bitrix-oauth-state';

export default defineEventHandler((event) => {
  if (!isBitrixAuthConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'Bitrix OAuth не настроен на сервере' });
  }

  const config = useRuntimeConfig();
  const state = randomBytes(16).toString('hex');
  const redirectUri = getBitrixRedirectUri(event);

  setCookie(event, STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600
  });

  const portal = String(config.bitrixPortalUrl).replace(/\/+$/, '');
  const url = new URL(`${portal}/oauth/authorize/`);
  url.searchParams.set('client_id', String(config.bitrixClientId));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  return sendRedirect(event, url.toString());
});
