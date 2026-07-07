export type DeployAppEnv = 'development' | 'staging' | 'production';

export function getDeployAppEnv(): DeployAppEnv {
  const raw = process.env.NUXT_PUBLIC_APP_ENV || 'development';
  if (raw === 'staging' || raw === 'production') return raw;
  return 'development';
}

/** Разные имена cookie на тесте и бою — иначе сессия «течёт» между :8080 и :80. */
export function sessionCookieName(): string {
  const env = getDeployAppEnv();
  if (env === 'staging') return 'vbi-session-staging';
  if (env === 'production') return 'vbi-session';
  return 'vbi-session-dev';
}

export function bitrixOAuthStateCookieName(): string {
  const env = getDeployAppEnv();
  if (env === 'staging') return 'bitrix-oauth-state-staging';
  if (env === 'production') return 'bitrix-oauth-state';
  return 'bitrix-oauth-state-dev';
}
