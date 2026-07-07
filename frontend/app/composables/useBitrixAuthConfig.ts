type AuthConfig = {
  bitrixAuthEnabled: boolean;
  oauthMisconfigured?: boolean;
  oauthMisconfiguredHint?: string | null;
};

/** Runtime: Bitrix OAuth включён на сервере (не зависит от NUXT_PUBLIC_APP_ENV в сборке). */
export function useBitrixAuthConfig() {
  const { isStaging, isProduction } = useAppEnv();

  const { data, status } = useFetch<AuthConfig>('/api/auth/config', {
    key: 'auth-config'
  });

  const bitrixAuthEnabled = computed(() => data.value?.bitrixAuthEnabled === true);
  const oauthMisconfigured = computed(() => data.value?.oauthMisconfigured === true);
  const oauthMisconfiguredHint = computed(() => data.value?.oauthMisconfiguredHint ?? null);
  const configReady = computed(() => status.value !== 'pending');

  const preferBitrixLogin = computed(
    () => bitrixAuthEnabled.value || isStaging.value || isProduction.value
  );

  return {
    bitrixAuthEnabled,
    oauthMisconfigured,
    oauthMisconfiguredHint,
    configReady,
    preferBitrixLogin
  };
}
