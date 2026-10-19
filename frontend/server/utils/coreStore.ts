import { getDb, isDbEnabled } from '../db/client';
import { createPgCoreRepo } from '../db/repositories/core';
import { createJsonCoreRepo } from '../core/jsonStore';
import type { CoreRepo } from '../core/types';

/**
 * Хранилище домена core (сотрудники, overlay руководителей, оргструктура).
 * DB_CORE=1 и задан DATABASE_URL → Postgres (схема core), иначе JSON-файлы server/data.
 * Флаг стоит только на стейдже; на проде DATABASE_URL есть, но флага нет → JSON.
 * Публичный API не меняется: employeesStore / employeeManagersStore / orgStructureStore.
 */
export function coreDbFlag(): boolean {
  return String(process.env.DB_CORE || '').trim() === '1' && isDbEnabled();
}

let resolvePgReady!: (ok: boolean) => void;
const pgReady = new Promise<boolean>((resolve) => {
  resolvePgReady = resolve;
});

/** Вызывает плагин db-migrate: true — миграции и импорт прошли, можно работать с Postgres. */
export function setCorePgReady(ok: boolean) {
  resolvePgReady(ok);
}

let jsonRepo: CoreRepo | null = null;
let pgRepo: CoreRepo | null = null;
let warnedFallback = false;

export async function coreRepo(): Promise<CoreRepo> {
  if (coreDbFlag()) {
    const ok = await pgReady;
    const db = ok ? getDb() : null;
    if (db) return (pgRepo ??= createPgCoreRepo(db));
    if (!warnedFallback) {
      warnedFallback = true;
      console.error('[core] DB_CORE=1, но Postgres недоступен — сотрудники и оргструктура на JSON (бэкап может быть устаревшим)');
    }
  }
  return (jsonRepo ??= createJsonCoreRepo());
}

export async function getCoreBackend(): Promise<'json' | 'postgres'> {
  return (await coreRepo()).backend;
}
