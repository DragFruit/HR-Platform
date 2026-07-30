import { isProductionBrowserHost } from '~/utils/productionHost';

export type AppEnv = 'development' | 'staging' | 'production';

export function useAppEnv() {
  const config = useRuntimeConfig();
  const url = useRequestURL();

  const onProductionHost = computed(() =>
    isProductionBrowserHost(url.hostname, url.port)
  );

  const appEnv = computed<AppEnv>(() => {
    // Хост боя важнее baked-конфига: ошибочный деплой development-сборки не должен
    // отключать production-гейты (замки меню, ачивки, org-links).
    if (onProductionHost.value) return 'production';
    const raw = config.public.appEnv;
    if (raw === 'staging' || raw === 'production') return raw;
    return 'development';
  });

  const isStaging = computed(() => appEnv.value === 'staging');
  const isProduction = computed(() => appEnv.value === 'production');
  const isDevelopment = computed(() => appEnv.value === 'development');

  const orgLinksEnabled = computed(() => {
    if (onProductionHost.value || appEnv.value === 'production') return false;
    return Boolean(config.public.orgLinksEnabled);
  });

  return {
    appEnv,
    isStaging,
    isProduction,
    isDevelopment,
    orgLinksEnabled
  };
}
