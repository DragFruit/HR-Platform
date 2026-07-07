import type { AppEnv } from '~/composables/useAppEnv';

/** localStorage на одном хосте, но разных портах — разные origin; суффикс env — для ясности и dev. */
export function clientStorageKey(base: string, appEnv: AppEnv): string {
  if (appEnv === 'production') return base;
  return `${base}@${appEnv}`;
}
