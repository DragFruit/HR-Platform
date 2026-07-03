declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

/** Дополнительные hit при смене маршрута Nuxt (основной init — в head через nuxt.config). */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const counterId = Number(config.public.yandexMetrikaId);
  if (!Number.isFinite(counterId) || counterId <= 0) return;

  const router = useRouter();

  const sendHit = (path: string) => {
    if (typeof window.ym !== 'function') return;
    const url = path.startsWith('http') ? path : window.location.origin + path;
    window.ym(counterId, 'hit', url, {
      title: document.title,
      referer: document.referrer
    });
  };

  router.afterEach((to) => {
    sendHit(to.fullPath);
  });
});
