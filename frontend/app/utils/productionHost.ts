/**
 * Бой и тест на одном IP (45.12.74.25): бой — порт 80 / без порта, тест — :8080.
 * Нельзя опираться только на baked NUXT_PUBLIC_APP_ENV: локальный `npm run build`
 * без env даёт development/full и при выкладке на :80 открывает черновики сотрудникам.
 */
export const PRODUCTION_VPS_HOST = '45.12.74.25';

export function isProductionBrowserHost(hostname: string, port: string): boolean {
  if (hostname !== PRODUCTION_VPS_HOST) return false;
  return port === '' || port === '80';
}
