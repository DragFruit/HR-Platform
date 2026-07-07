export type DeployAppEnv = 'development' | 'staging' | 'production';

/** Окружение из сборки (NUXT_PUBLIC_APP_ENV) или из BITRIX_REDIRECT_URI на VPS. */
export function getDeployAppEnv(): DeployAppEnv {
  try {
    const { public: pub } = useRuntimeConfig();
    const baked = String(pub.appEnv || '');
    if (baked === 'staging' || baked === 'production') return baked;
  } catch {
    /* вне Nitro-контекста */
  }

  const fromProcess = process.env.NUXT_PUBLIC_APP_ENV;
  if (fromProcess === 'staging' || fromProcess === 'production') return fromProcess;

  const redirect = String(process.env.BITRIX_REDIRECT_URI || '').trim();
  if (redirect.includes(':8080')) return 'staging';
  if (redirect.includes('/api/auth/bitrix/callback') && !redirect.includes(':8080')) {
    return 'production';
  }

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
