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

export function getAppPublicOrigin(event?: H3Event): string {
  const appUrl = String(process.env.APP_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      /* fall through */
    }
  }

  const { bitrixRedirectUri } = getBitrixConfig();
  if (bitrixRedirectUri) {
    try {
      return new URL(bitrixRedirectUri).origin;
    } catch {
      /* fall through */
    }
  }

  if (!event) {
    throw createError({ statusCode: 500, statusMessage: 'Не удалось определить публичный URL приложения' });
  }

  const forwardedHost = getRequestHeader(event, 'x-forwarded-host');
  const forwardedProto = getRequestHeader(event, 'x-forwarded-proto') || 'http';
  const forwardedPort = getRequestHeader(event, 'x-forwarded-port');

  if (forwardedHost) {
    const hostHasPort = forwardedHost.includes(':');
    const needsPort =
      !hostHasPort && forwardedPort && !['80', '443'].includes(String(forwardedPort));
    const host = needsPort ? `${forwardedHost}:${forwardedPort}` : forwardedHost;
    return `${forwardedProto}://${host}`;
  }

  return getRequestURL(event).origin;
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
  return `${getAppPublicOrigin(event)}/api/auth/bitrix/callback`;
}
