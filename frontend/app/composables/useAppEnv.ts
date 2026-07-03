export type AppEnv = 'development' | 'staging' | 'production';

export function useAppEnv() {
  const config = useRuntimeConfig();

  const appEnv = computed<AppEnv>(() => {
    const raw = config.public.appEnv;
    if (raw === 'staging' || raw === 'production') return raw;
    return 'development';
  });

  const isStaging = computed(() => appEnv.value === 'staging');
  const isProduction = computed(() => appEnv.value === 'production');
  const isDevelopment = computed(() => appEnv.value === 'development');

  const orgLinksEnabled = computed(() => Boolean(config.public.orgLinksEnabled));

  return {
    appEnv,
    isStaging,
    isProduction,
    isDevelopment,
    orgLinksEnabled
  };
}
