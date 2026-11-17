/**
 * Хосты боя. Бой и стейдж живут на одном IP и различаются только портом:
 * - старый VPS 45.12.74.25: бой — порт 80 / без порта, стейдж — :8080;
 * - офисный сервер 178.176.44.94 (с 2026-11-13): бой — снаружи :9180 (проброс на nginx :80),
 *   стейдж — :8080. Порт 80 / без порта на этом IP тоже считаем боем (так только строже).
 * Нельзя опираться только на baked NUXT_PUBLIC_APP_ENV: локальный `npm run build`
 * без env даёт development/full и при выкладке на бой открывает черновики сотрудникам.
 * - домен vibe.testvbi.ru (с 2026-11-17): только бой, без порта / :80 / :443 (стейдж остаётся на IP:8080).
 * nginx передаёт Host как $http_host (с портом), поэтому на SSR порт виден так же, как в браузере.
 */
export const PRODUCTION_VPS_HOST = '45.12.74.25';
export const PRODUCTION_OFFICE_HOST = '178.176.44.94';
export const PRODUCTION_DOMAIN = 'vibe.testvbi.ru';

/** Хост → порты, на которых этот хост = бой ('' = порт не указан). */
const PRODUCTION_HOST_PORTS: Readonly<Record<string, readonly string[]>> = {
  [PRODUCTION_VPS_HOST]: ['', '80'],
  [PRODUCTION_OFFICE_HOST]: ['', '80', '9180'],
  [PRODUCTION_DOMAIN]: ['', '80', '443']
};

export function isProductionBrowserHost(hostname: string, port: string): boolean {
  const ports = PRODUCTION_HOST_PORTS[hostname];
  if (!ports) return false;
  return ports.includes(port);
}
