import type { H3Event } from 'h3';
import { refreshLocalEnv } from './loadEnvFile';
import { getDeployAppEnv } from './appEnv';
import {
  BITRIX_STAGING_CALLBACK,
  isProductionBitrixClientId
} from './bitrixOAuthConstants';

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
  if (isLocalDevelopment()) {
    refreshLocalEnv();
  }

  const config = useRuntimeConfig();
  const env = process.env;
  return {
    bitrixPortalUrl: String(env.BITRIX_PORTAL_URL || config.bitrixPortalUrl || '').replace(/\/+$/, ''),
    bitrixClientId: String(env.BITRIX_CLIENT_ID || '').trim(),
    bitrixClientSecret: String(env.BITRIX_CLIENT_SECRET || '').trim(),
    bitrixRedirectUri: String(env.BITRIX_REDIRECT_URI || '').trim(),
    bitrixAdminGroupIds: String(env.BITRIX_ADMIN_GROUP_IDS || config.bitrixAdminGroupIds || '1'),
    bitrixHrGroupIds: String(env.BITRIX_HR_GROUP_IDS || config.bitrixHrGroupIds || ''),
    bitrixManagerGroupIds: String(env.BITRIX_MANAGER_GROUP_IDS || config.bitrixManagerGroupIds || '')
  };
}

export function getBitrixWebhookUrl(): string {
  return String(process.env.BITRIX_WEBHOOK_URL || '').trim().replace(/\/+$/, '');
}

export function isBitrixWebhookConfigured(): boolean {
  return Boolean(getBitrixWebhookUrl());
}

export function getRequestPublicOrigin(event: H3Event): string {
  const forwardedHost = getRequestHeader(event, 'x-forwarded-host');
  const forwardedProto = getRequestHeader(event, 'x-forwarded-proto') || 'http';
  const forwardedPort = getRequestHeader(event, 'x-forwarded-port');
  const hostHeader = getRequestHeader(event, 'host');
  const host = forwardedHost || hostHeader;

  if (host) {
    const hostHasPort = host.includes(':');
    const needsPort =
      !hostHasPort && forwardedPort && !['80', '443'].includes(String(forwardedPort));
    const fullHost = needsPort ? `${host}:${forwardedPort}` : host;
    return `${forwardedProto}://${fullHost}`;
  }

  return getRequestURL(event).origin;
}

/** Origin текущего запроса; без event — только из APP_PUBLIC_URL (fallback для скриптов). */
export function getAppPublicOrigin(event?: H3Event): string {
  if (event) return getRequestPublicOrigin(event);

  const appUrl = String(process.env.APP_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      /* fall through */
    }
  }

  throw createError({ statusCode: 500, statusMessage: 'Не удалось определить публичный URL приложения' });
}

export function isStagingUsingProductionBitrixApp(): boolean {
  if (getDeployAppEnv() !== 'staging') return false;
  const { bitrixClientId } = getBitrixConfig();
  return isProductionBitrixClientId(bitrixClientId);
}

export function stagingBitrixMisconfigMessage(): string {
  return (
    'На тестовом стенде (:8080) указан CLIENT_ID боевого приложения Битрикс. ' +
    'У одного приложения в коробке только один обработчик — Битрикс всегда вернёт на :80, отсюда «Неверный state». ' +
    `Создайте отдельное локальное приложение в crm.vbi.ru с обработчиком ${BITRIX_STAGING_CALLBACK} ` +
    'и пропишите его CLIENT_ID и SECRET в /etc/vbi-hr/bitrix.env, затем: sudo systemctl restart vbi-hr-staging'
  );
}

export function assertStagingBitrixAppConfigured(event: H3Event) {
  if (!isStagingUsingProductionBitrixApp()) return;

  const requestOrigin = getRequestPublicOrigin(event);
  throw createError({
    statusCode: 503,
    statusMessage: stagingBitrixMisconfigMessage(),
    data: { requestOrigin, expectedCallback: BITRIX_STAGING_CALLBACK }
  });
}

export function isBitrixAuthConfigured(): boolean {
  const { bitrixPortalUrl, bitrixClientId, bitrixClientSecret } = getBitrixConfig();
  return Boolean(bitrixPortalUrl && bitrixClientId && bitrixClientSecret);
}

export function isLocalDevelopment(): boolean {
  const appEnv = process.env.NUXT_PUBLIC_APP_ENV || 'development';
  return appEnv === 'development';
}

export function getBitrixRedirectUri(event?: H3Event): string {
  if (event && isLocalDevelopment()) {
    return `${getRequestPublicOrigin(event)}/api/auth/bitrix/callback`;
  }

  const { bitrixRedirectUri } = getBitrixConfig();
  if (bitrixRedirectUri) return bitrixRedirectUri;
  if (!event) {
    throw createError({ statusCode: 500, statusMessage: 'BITRIX_REDIRECT_URI не задан' });
  }
  return `${getRequestPublicOrigin(event)}/api/auth/bitrix/callback`;
}

/** После OAuth возвращаем на тот origin, куда пришёл callback (тест :8080 / бой :80). */
export function getOAuthReturnOrigin(event: H3Event): string {
  return getRequestPublicOrigin(event);
}

/** Перед OAuth: callback должен быть на том же origin, что и текущий сайт. */
export function assertBitrixOAuthOrigin(event: H3Event, redirectUri: string) {
  const requestOrigin = getRequestPublicOrigin(event);
  let redirectOrigin: string;
  try {
    redirectOrigin = new URL(redirectUri).origin;
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Некорректный BITRIX_REDIRECT_URI' });
  }

  if (requestOrigin === redirectOrigin) return;

  throw createError({
    statusCode: 400,
    statusMessage:
      `OAuth: сайт открыт на ${requestOrigin}, а callback настроен на ${redirectOrigin}. ` +
      'Для локальной разработки — отдельное приложение в Битриксе с обработчиком ' +
      `${requestOrigin}/api/auth/bitrix/callback и свои CLIENT_ID/SECRET в frontend/.env.`
  });
}
