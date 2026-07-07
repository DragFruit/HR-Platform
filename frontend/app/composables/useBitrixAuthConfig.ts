type AuthConfig = {
  bitrixAuthEnabled: boolean;
  oauthMisconfigured?: boolean;
  oauthMisconfiguredHint?: string;
};

/** Runtime: Bitrix OAuth включён на сервере (не зависит от NUXT_PUBLIC_APP_ENV в сборке). */
export function useBitrixAuthConfig() {
  const { isStaging, isProduction } = useAppEnv();

  const { data, status } = useFetch<AuthConfig>('/api/auth/config', {
    key: 'auth-config'
  });

  const bitrixAuthEnabled = computed(() => data.value?.bitrixAuthEnabled === true);
  const configReady = computed(() => status.value !== 'pending');
  const oauthMisconfigured = computed(() => data.value?.oauthMisconfigured === true);
  const oauthMisconfiguredHint = computed(() => data.value?.oauthMisconfiguredHint ?? '');

  const preferBitrixLogin = computed(
    () => bitrixAuthEnabled.value || isStaging.value || isProduction.value
  );

  return {
    bitrixAuthEnabled,
    configReady,
    preferBitrixLogin,
    oauthMisconfigured,
    oauthMisconfiguredHint
  };
}
