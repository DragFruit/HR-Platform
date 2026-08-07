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

  const { bitrixClientId, bitrixClientSecret, bitrixRedirectUri } = getBitrixConfig();
  const redirectUri = getBitrixRedirectUri(event);

  return {
    requestOrigin: getRequestPublicOrigin(event),
    redirectUri,
    bitrixRedirectUriFromEnv: bitrixRedirectUri || null,
    clientId: bitrixClientId,
    secretConfigured: Boolean(bitrixClientSecret),
    usesProdClientId: bitrixClientId === PROD_CLIENT_ID,
    bitrixAuthEnabled: isBitrixAuthConfigured(),
    hint:
      bitrixClientId === PROD_CLIENT_ID
        ? 'В .env всё ещё ключи боя. Сохраните frontend/.env с dev CLIENT_ID и перезапустите npm run dev.'
        : !bitrixClientSecret
          ? 'BITRIX_CLIENT_SECRET пустой в frontend/.env'
          : `В Битриксе у приложения ${bitrixClientId} обработчик: ${redirectUri}. При invalid_client — перекопируйте Client Secret из этого же приложения.`
  };
});
