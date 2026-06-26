import {
  getBitrixConfig,
  getBitrixRedirectUri,
  getRequestPublicOrigin,
  isBitrixAuthConfigured,
  isLocalDevelopment
} from '../../utils/bitrixConfig';

const PROD_CLIENT_ID = 'local.6a3d853b126b27.83139285';

export default defineEventHandler((event) => {
  if (!isLocalDevelopment()) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const { bitrixClientId, bitrixRedirectUri } = getBitrixConfig();
  const redirectUri = getBitrixRedirectUri(event);

  return {
    requestOrigin: getRequestPublicOrigin(event),
    redirectUri,
    bitrixRedirectUriFromEnv: bitrixRedirectUri || null,
    clientId: bitrixClientId,
    usesProdClientId: bitrixClientId === PROD_CLIENT_ID,
    bitrixAuthEnabled: isBitrixAuthConfigured(),
    hint:
      bitrixClientId === PROD_CLIENT_ID
        ? 'В .env всё ещё ключи боя. Сохраните frontend/.env с dev CLIENT_ID и перезапустите npm run dev.'
        : `В Битриксе у dev-приложения обработчик должен быть ровно: ${redirectUri}`
  };
});
