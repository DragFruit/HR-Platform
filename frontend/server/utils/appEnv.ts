export type DeployAppEnv = 'development' | 'staging' | 'production';

const asDeployAppEnv = (raw: string): DeployAppEnv | null => {
  if (raw === 'development' || raw === 'staging' || raw === 'production') return raw;
  return null;
};

const isLocalHostRedirect = (redirect: string) => {
  try {
    const host = new URL(redirect).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return (
      redirect.includes('localhost') ||
      redirect.includes('127.0.0.1') ||
      redirect.includes('[::1]')
    );
  }
};

/** Окружение из сборки (NUXT_PUBLIC_APP_ENV) или из BITRIX_REDIRECT_URI на VPS. */
export function getDeployAppEnv(): DeployAppEnv {
  try {
    const { public: pub } = useRuntimeConfig();
    const baked = asDeployAppEnv(String(pub.appEnv || ''));
    if (baked) return baked;
  } catch {
    /* вне Nitro-контекста */
  }

  const fromProcess = asDeployAppEnv(String(process.env.NUXT_PUBLIC_APP_ENV || ''));
  if (fromProcess) return fromProcess;

  const redirect = String(process.env.BITRIX_REDIRECT_URI || '').trim();
  if (redirect) {
    // localhost callback ≠ бой: иначе local `.env` с BITRIX_REDIRECT_URI
    // ошибочно становился production и резал QA-идеи (ФИО «*Тестов*»).
    if (isLocalHostRedirect(redirect)) return 'development';
    if (redirect.includes(':8080')) return 'staging';
    if (redirect.includes('/api/auth/bitrix/callback')) return 'production';
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
