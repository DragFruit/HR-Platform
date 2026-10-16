import { join } from 'node:path';

/**
 * Какие env-файлы читает плагин load-bitrix-env на каждом стенде.
 * Стейдж и бой живут на одном VPS, и пользователь deploy читает оба файла в /etc/vbi-hr —
 * поэтому стенд грузит ТОЛЬКО свой файл. Раньше читались оба (боевой побеждал), и стейдж
 * получал боевые ключи Битрикса (мост уведомлений, чат-бот, инфоблок отсутствий, DATABASE_URL).
 */
export type Stand = 'development' | 'staging' | 'production';

export const STAGING_ENV_FILE = '/etc/vbi-hr/bitrix.env';
export const PRODUCTION_ENV_FILE = '/etc/vbi-hr/bitrix-production.env';

/** Стенд строго из NUXT_PUBLIC_APP_ENV (запечён в сборку CI). Непонятное значение → null (не угадываем). */
export function resolveStand(raw: unknown): Stand | null {
  const value = String(raw ?? '').trim();
  if (value === 'development' || value === 'staging' || value === 'production') return value;
  return null;
}

/**
 * Файлы в порядке применения (последний побеждает).
 * Свой каталог приложения (.env — копия файла своего стенда при деплое) + файл своего стенда в /etc.
 * development — только локальные файлы (как и раньше: на Mac /etc/vbi-hr нет).
 * Стенд не определён → пусто (fail safe).
 */
export function standEnvFiles(stand: Stand | null, cwd: string): string[] {
  if (!stand) return [];
  const local = [join(cwd, '.env'), join(cwd, 'bitrix.env')];
  if (stand === 'staging') return [...local, STAGING_ENV_FILE];
  if (stand === 'production') return [...local, PRODUCTION_ENV_FILE];
  return local;
}
