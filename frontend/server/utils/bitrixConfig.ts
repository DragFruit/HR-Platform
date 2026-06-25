import type { H3Event } from 'h3';

export type BitrixRuntimeConfig = {
  bitrixPortalUrl: string;
  bitrixClientId: string;
  bitrixClientSecret: string;
  bitrixRedirectUri: string;
  bitrixAdminGroupIds: string;
  bitrixHrGroupIds: string;
  bitrixManagerGroupIds: string;
};

export function parseGroupIds(raw: string): number[] {
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export function getBitrixConfig(): BitrixRuntimeConfig {
  const config = useRuntimeConfig();
  return {
    bitrixPortalUrl: String(config.bitrixPortalUrl || '').replace(/\/+$/, ''),
    bitrixClientId: String(config.bitrixClientId || ''),
    bitrixClientSecret: String(config.bitrixClientSecret || ''),
    bitrixRedirectUri: String(config.bitrixRedirectUri || ''),
    bitrixAdminGroupIds: String(config.bitrixAdminGroupIds || '1'),
    bitrixHrGroupIds: String(config.bitrixHrGroupIds || ''),
    bitrixManagerGroupIds: String(config.bitrixManagerGroupIds || '')
  };
}

export function isBitrixAuthConfigured(): boolean {
  const { bitrixPortalUrl, bitrixClientId, bitrixClientSecret } = getBitrixConfig();
  return Boolean(bitrixPortalUrl && bitrixClientId && bitrixClientSecret);
}

export function getBitrixRedirectUri(event?: H3Event): string {
  const { bitrixRedirectUri } = getBitrixConfig();
  if (bitrixRedirectUri) return bitrixRedirectUri;
  if (!event) {
    throw createError({ statusCode: 500, statusMessage: 'BITRIX_REDIRECT_URI не задан' });
  }
  const url = getRequestURL(event);
  return `${url.origin}/api/auth/bitrix/callback`;
}
