import {
  getBitrixConfig,
  getBitrixRedirectUri,
  getRequestPublicOrigin,
  isBitrixAuthConfigured,
  isLocalDevelopment
} from '../../utils/bitrixConfig';

const maskClientId = (id: string): string => {
  const value = String(id || '').trim();
  if (!value) return '';
  if (value.length <= 12) return '***';
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
};

/** Похоже на ключи/redirect боя — без захардкоженного client_id в репозитории. */
const looksLikeProductionRedirect = (redirectUri: string, requestOrigin: string): boolean => {
  const haystack = `${redirectUri} ${requestOrigin}`;
  return /45\.12\.74\.25(?!:8080)/.test(haystack) || /vibe\.vbi\.ru/.test(haystack);
};

export default defineEventHandler((event) => {
  if (!isLocalDevelopment()) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const { bitrixClientId, bitrixClientSecret, bitrixRedirectUri } = getBitrixConfig();
  const redirectUri = getBitrixRedirectUri(event);
  const requestOrigin = getRequestPublicOrigin(event);
  const prodRedirect = looksLikeProductionRedirect(redirectUri, requestOrigin);

  return {
    requestOrigin,
    redirectUri,
    bitrixRedirectUriFromEnv: bitrixRedirectUri || null,
    clientIdMasked: maskClientId(bitrixClientId),
    secretConfigured: Boolean(bitrixClientSecret),
    redirectLooksLikeProduction: prodRedirect,
    bitrixAuthEnabled: isBitrixAuthConfigured(),
    hint: prodRedirect
      ? 'Redirect похож на бой — в frontend/.env нужны ключи и redirect локального/dev-приложения, не production.'
      : !bitrixClientSecret
        ? 'BITRIX_CLIENT_SECRET пустой в frontend/.env'
        : `В Битриксе у приложения ${maskClientId(bitrixClientId)} обработчик: ${redirectUri}. При invalid_client — перекопируйте Client Secret из этого же приложения.`
  };
});
