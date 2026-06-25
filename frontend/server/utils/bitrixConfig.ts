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
  const env = process.env;
  return {
    bitrixPortalUrl: String(env.BITRIX_PORTAL_URL || config.bitrixPortalUrl || '').replace(/\/+$/, ''),
    bitrixClientId: String(env.BITRIX_CLIENT_ID || config.bitrixClientId || ''),
    bitrixClientSecret: String(env.BITRIX_CLIENT_SECRET || config.bitrixClientSecret || ''),
    bitrixRedirectUri: String(env.BITRIX_REDIRECT_URI || config.bitrixRedirectUri || ''),
    bitrixAdminGroupIds: String(env.BITRIX_ADMIN_GROUP_IDS || config.bitrixAdminGroupIds || '1'),
    bitrixHrGroupIds: String(env.BITRIX_HR_GROUP_IDS || config.bitrixHrGroupIds || ''),
    bitrixManagerGroupIds: String(env.BITRIX_MANAGER_GROUP_IDS || config.bitrixManagerGroupIds || '')
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
