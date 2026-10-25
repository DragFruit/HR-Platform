import { asc, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { writeAudit, type AuditEntry } from '../audit';
import { accessDenylist as t } from '../schema';
import { chunks } from './core';
import { createMutationQueue } from '../../utils/atomicJson';
import {
  ACCESS_DENYLIST_JSON_FILE,
  denylistEntryLabel,
  denylistEntryToRow,
  readAccessDenylistJson,
  rowToDenylistEntry,
  writeAccessDenylistJson,
  type AccessDenylistEntry,
  type AccessDenylistRepo
} from '../../core/accessDenylistStore';

/** Свой pg_advisory_xact_lock: запись стоп-листа (не общий с core — без риска взаимной блокировки). */
export const ACCESS_DENYLIST_WRITE_LOCK_KEY = 72_461_007;
export const ACCESS_DENYLIST_AUDIT_ENTITY = 'core.access_denylist';

/** Как у core: все записи идут через процесс и сразу обновляют кэш; TTL — для ручной правки в базе. */
export const ACCESS_DENYLIST_CACHE_TTL_MS = 30_000;

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export async function loadDenylistRows(q: Pick<Db, 'select'>) {
  return q.select().from(t).orderBy(asc(t.position), asc(t.id));
}

export async function lockAccessDenylist(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(${ACCESS_DENYLIST_WRITE_LOCK_KEY})`);
}

const clone = <T>(v: T): T => structuredClone(v);
const asStored = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export type PgAccessDenylistOptions = {
  cacheTtlMs?: number;
  /**
   * JSON-зеркало: после каждой успешной записи в базу стоп-лист дублируется в этот файл.
   * Это запасной источник, если база недоступна (см. read). null — без зеркала (тесты).
   */
  mirrorFile?: string | null;
};

/**
 * Стоп-лист в Postgres (core.access_denylist). Стоит на пути авторизации, поэтому:
 * - чтение из кэша процесса (TTL 30 с, запись обновляет сразу);
 * - база не ответила → последний успешно прочитанный список (даже старше TTL);
 *   если его нет (первый запрос после старта) → JSON-зеркало. Никого не впускаем «вслепую»
 *   (пустой список при ошибке не отдаём) и не закрываем вход всем (ошибку наружу не бросаем).
 *   Каждый такой случай пишется в console.error.
 * - запись: транзакция под advisory lock + аудит; после коммита — зеркало в JSON.
 */
export function createPgAccessDenylistRepo(db: Db, opts: PgAccessDenylistOptions = {}): AccessDenylistRepo {
  const ttl = opts.cacheTtlMs ?? ACCESS_DENYLIST_CACHE_TTL_MS;
  const mirror = opts.mirrorFile === undefined ? ACCESS_DENYLIST_JSON_FILE : opts.mirrorFile;
  const enqueue = createMutationQueue();
  let cache: { value: AccessDenylistEntry[]; at: number } | null = null;
  let version = 0;
  let lastErrorLogAt = 0;

  function logFallback(err: unknown, source: string) {
    const now = Date.now();
    if (now - lastErrorLogAt < 60_000) return;
    lastErrorLogAt = now;
    console.error(
      `[core] стоп-лист: Postgres не ответил (${String((err as { message?: string })?.message || err).slice(0, 160)}) — проверяем по ${source}`
    );
  }

  async function read(): Promise<AccessDenylistEntry[]> {
    if (cache && Date.now() - cache.at < ttl) return clone(cache.value);
    const v0 = version;
    try {
      const value = (await loadDenylistRows(db)).map(rowToDenylistEntry);
      if (v0 === version) cache = { value, at: Date.now() };
      return clone(value);
    } catch (err) {
      if (cache) {
        logFallback(err, 'последнему прочитанному списку');
        return clone(cache.value);
      }
      if (mirror) {
        logFallback(err, 'JSON-зеркалу');
        return readAccessDenylistJson(mirror);
      }
      throw err;
    }
  }

  async function mutate(fn: (entries: AccessDenylistEntry[]) => AccessDenylistEntry[] | null, ctx: { actorEmployeeId?: number | null; reason?: string } = {}) {
    await enqueue(async () => {
      let written: AccessDenylistEntry[] | null = null;
      await db.transaction(async (tx) => {
        await lockAccessDenylist(tx);
        const prevRows = await loadDenylistRows(tx);
        const prev = prevRows.map(rowToDenylistEntry);
        const nextRaw = fn(clone(prev));
        if (!nextRaw) return;
        const next = asStored(nextRaw);
        if (JSON.stringify(next) === JSON.stringify(prev)) return;

        const rows = next.map((e, i) => {
          const row = denylistEntryToRow(e, i);
          if (!row) throw new Error('[core] стоп-лист: запись не объект — запись отменена');
          return row;
        });

        // Аудит: что добавилось / ушло (сравнение записей целиком).
        const prevSet = new Map(prev.map((e) => [JSON.stringify(e), e]));
        const nextSet = new Map(next.map((e) => [JSON.stringify(e), e]));
        const actor = { actorEmployeeId: ctx.actorEmployeeId ?? null };
        const reason = ctx.reason ?? null;
        const audits: AuditEntry[] = [];
        for (const [k, e] of nextSet) {
          if (!prevSet.has(k)) audits.push({ ...actor, action: 'upsert', entity: ACCESS_DENYLIST_AUDIT_ENTITY, entityId: denylistEntryLabel(e), after: { reason, ...e } });
        }
        for (const [k, e] of prevSet) {
          if (!nextSet.has(k)) audits.push({ ...actor, action: 'remove', entity: ACCESS_DENYLIST_AUDIT_ENTITY, entityId: denylistEntryLabel(e), before: e, after: reason ? { reason } : null });
        }

        await tx.delete(t);
        for (const part of chunks(rows)) await tx.insert(t).values(part);
        for (const part of chunks(audits, 200)) await writeAudit(tx, part);
        written = next;
      });
      const saved = written as AccessDenylistEntry[] | null;
      if (!saved) return;
      version += 1;
      cache = { value: clone(saved), at: Date.now() };
      if (mirror) {
        try {
          await writeAccessDenylistJson(mirror, saved);
        } catch (err) {
          console.error('[core] стоп-лист: не удалось обновить JSON-зеркало:', (err as Error)?.message || err);
        }
      }
    });
  }

  return { backend: 'postgres', read, mutate };
}
