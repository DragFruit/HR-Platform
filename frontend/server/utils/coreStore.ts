import { getDb, isDbEnabled } from '../db/client';
import { createPgCoreRepo } from '../db/repositories/core';
import { createJsonCoreRepo } from '../core/jsonStore';
import type { CoreRepo } from '../core/types';
import { createPgAccessDenylistRepo } from '../db/repositories/accessDenylist';
import { createJsonAccessDenylistRepo, type AccessDenylistRepo } from '../core/accessDenylistStore';

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

// ---------- стоп-лист доступа (этап 5) ----------

/**
 * Стоп-лист под тем же флагом DB_CORE, но со своей готовностью: если его импорт упал,
 * сотрудники и оргструктура (уже на Postgres с этапа 3) не откатываются на устаревшие файлы,
 * а стоп-лист остаётся на своём актуальном JSON-файле.
 */
let resolveDenylistReady!: (ok: boolean) => void;
const denylistReady = new Promise<boolean>((resolve) => {
  resolveDenylistReady = resolve;
});

/** Вызывает плагин db-migrate после импорта стоп-листа. */
export function setAccessDenylistPgReady(ok: boolean) {
  resolveDenylistReady(ok);
}

let denylistJsonRepo: AccessDenylistRepo | null = null;
let denylistPgRepo: AccessDenylistRepo | null = null;
let warnedDenylistFallback = false;

export async function accessDenylistRepo(): Promise<AccessDenylistRepo> {
  if (coreDbFlag()) {
    const ok = await denylistReady;
    const db = ok ? getDb() : null;
    if (db) return (denylistPgRepo ??= createPgAccessDenylistRepo(db));
    if (!warnedDenylistFallback) {
      warnedDenylistFallback = true;
      console.error('[core] DB_CORE=1, но стоп-лист не на Postgres — проверяем по JSON-файлу');
    }
  }
  return (denylistJsonRepo ??= createJsonAccessDenylistRepo());
}

export async function getAccessDenylistBackend(): Promise<'json' | 'postgres'> {
  return (await accessDenylistRepo()).backend;
}
