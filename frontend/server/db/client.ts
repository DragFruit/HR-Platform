import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * PostgreSQL (фаза 1 миграции с JSON — только фундамент).
 * Без `DATABASE_URL` всё DB-шное выключено: getDb() → null, приложение работает на JSON как раньше.
 */
export type Db = PostgresJsDatabase<typeof schema>;

type DbState = { url: string; sql: postgres.Sql; db: Db };

let state: DbState | null = null;
let disabledReason: string | null = null;

/**
 * DATABASE_URL на момент старта процесса (systemd EnvironmentFile + run.sh → .env своего стенда).
 * Фиксируем при загрузке модуля — ДО плагина load-bitrix-env. Плагин теперь грузит только файл
 * своего стенда (standEnvFiles.ts), но страховку оставляем: раньше он подмешивал и боевой файл.
 */
const BOOT_DATABASE_URL = String(process.env.DATABASE_URL || '').trim();

export function getDatabaseUrl(): string {
  return BOOT_DATABASE_URL || String(process.env.DATABASE_URL || '').trim();
}

export function databaseNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
}

function currentAppEnv(): string {
  try {
    return String(useRuntimeConfig().public.appEnv || '');
  } catch {
    return String(process.env.NUXT_PUBLIC_APP_ENV || '');
  }
}

/** Вторая страховка от «стейдж пишет в боевую базу» (и наоборот) — по имени базы. */
export function dbEnvMismatch(appEnv: string, dbName: string): string | null {
  if (appEnv === 'staging' && dbName === 'vbi_prod') return 'staging-сборка смотрит в vbi_prod';
  if (appEnv === 'production' && dbName === 'vbi_staging') return 'production-сборка смотрит в vbi_staging';
  return null;
}

export function isDbEnabled(): boolean {
  return Boolean(getDatabaseUrl()) && !disabledReason;
}

export function getDbDisabledReason(): string | null {
  if (!getDatabaseUrl()) return 'DATABASE_URL не задан';
  return disabledReason;
}

/** Выключить DB до рестарта процесса (например, миграции упали). JSON-функции не затрагиваются. */
export function disableDb(reason: string) {
  disabledReason = reason;
}

/** Ленивый singleton. null — база выключена. */
export function getDb(): Db | null {
  const url = getDatabaseUrl();
  if (!url || disabledReason) return null;
  if (state && state.url === url) return state.db;

  const mismatch = dbEnvMismatch(currentAppEnv(), databaseNameFromUrl(url));
  if (mismatch) {
    disabledReason = mismatch;
    console.error(`[db] отключено: ${mismatch}`);
    return null;
  }

  const sql = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {}
  });
  state = { url, sql, db: drizzle(sql, { schema }) };
  return state.db;
}

/** Сырой postgres.js клиент того же пула (health-check, служебные запросы). */
export function getSql(): postgres.Sql | null {
  return getDb() ? state!.sql : null;
}
