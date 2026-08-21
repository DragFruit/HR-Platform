type AuthConfig = {
  bitrixAuthEnabled: boolean;
  vibePasswordLoginEnabled?: boolean;
  bitrixPasswordLoginEnabled?: boolean;
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
  const vibePasswordLoginEnabled = computed(
    () => data.value?.vibePasswordLoginEnabled === true
  );
  const bitrixPasswordLoginEnabled = computed(
    () => data.value?.bitrixPasswordLoginEnabled === true
  );
  const configReady = computed(() => status.value !== 'pending');
  const oauthMisconfigured = computed(() => data.value?.oauthMisconfigured === true);
  const oauthMisconfiguredHint = computed(() => data.value?.oauthMisconfiguredHint ?? '');

  const preferBitrixLogin = computed(
    () => bitrixAuthEnabled.value || isStaging.value || isProduction.value
  );

  return {
    bitrixAuthEnabled,
    vibePasswordLoginEnabled,
    bitrixPasswordLoginEnabled,
    configReady,
    preferBitrixLogin,
    oauthMisconfigured,
    oauthMisconfiguredHint
  };
}
