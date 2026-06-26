type AuthConfig = {
  bitrixAuthEnabled: boolean;
  appPublicUrl: string;
};

/** Runtime: Bitrix OAuth и канонический URL стенда (с портом :8080 на staging). */
export function useBitrixAuthConfig() {
  const { isStaging, isProduction } = useAppEnv();

  const { data, status } = useFetch<AuthConfig>('/api/auth/config', {
    key: 'auth-config'
  });

  const bitrixAuthEnabled = computed(() => data.value?.bitrixAuthEnabled === true);
  const appPublicUrl = computed(() => data.value?.appPublicUrl || '');
  const configReady = computed(() => status.value !== 'pending');

  const preferBitrixLogin = computed(
    () => bitrixAuthEnabled.value || isStaging.value || isProduction.value
  );

  const bitrixLoginUrl = computed(() => {
    const base = appPublicUrl.value.replace(/\/+$/, '');
    return base ? `${base}/api/auth/bitrix` : '/api/auth/bitrix';
  });

  const syncPublicOrigin = () => {
    if (!import.meta.client || !appPublicUrl.value) return;
    try {
      const expected = new URL(appPublicUrl.value).origin;
      if (window.location.origin === expected) return;
      const target = new URL(window.location.pathname + window.location.search, appPublicUrl.value);
      window.location.replace(target.toString());
    } catch {
      /* ignore */
    }
  };

  watch(appPublicUrl, syncPublicOrigin, { immediate: true });

  return {
    bitrixAuthEnabled,
    appPublicUrl,
    bitrixLoginUrl,
    configReady,
    preferBitrixLogin,
    syncPublicOrigin
  };
}
