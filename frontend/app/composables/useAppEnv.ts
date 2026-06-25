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

  const envLabel = computed(() => {
    if (isProduction.value) return 'Бой';
    return '';
  });

  return {
    appEnv,
    isStaging,
    isProduction,
    isDevelopment,
    envLabel
  };
}
