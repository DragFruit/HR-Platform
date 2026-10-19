import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Db } from '../client';
import { writeAudit, type AuditEntry } from '../audit';
import { chunks, excludedSet } from './core';
import { createMutationQueue } from '../../utils/atomicJson';

/**
 * Общий Postgres-репозиторий для «списка записей с ключом» из JSON-файла (этап 6: аватары,
 * лента активности, награды продаж, пароли Vibe). Тот же приём, что у уведомлений админки:
 * - чтение в порядке файла (position);
 * - mutate: очередь в процессе + транзакция под своим advisory lock; fn меняет копию списка
 *   на месте, в базу уходят только изменения (insert/update/delete по ключу) + аудит;
 * - ошибка в fn или в записи → ничего не записано.
 */

export type Key = string | number;

export type KeyedListWriteContext = {
  /** id сотрудника из справочника; null — система / cron / офбординг. */
  actorEmployeeId?: number | null;
  /** Метка источника: api, access-revoked, sales-best-publish, … */
  reason?: string;
};

export type KeyedListRepo<T> = {
  backend: 'json' | 'postgres';
  /** Все записи в порядке файла. */
  read(): Promise<T[]>;
  /**
   * Атомарное «прочитать → изменить → записать»: fn получает копию списка и меняет её на месте.
   * Правки строго по очереди; ошибка в fn → ничего не записано. Возвращает результат fn.
   */
  mutate<R>(fn: (items: T[]) => R | Promise<R>, ctx?: KeyedListWriteContext): Promise<R>;
};

export type KeyedChange<T> =
  | { kind: 'create'; key: Key; after: T }
  | { kind: 'update'; key: Key; before: T; after: T }
  | { kind: 'delete'; key: Key; before: T };

type Row = Record<string, unknown>;

export type KeyedListDef<T> = {
  table: PgTable;
  /** Свойство строки Drizzle с ключом (id / userId / employeeId). */
  keyProp: string;
  lockKey: number;
  auditEntity: string;
  logTag: string;
  /** null — запись не годится (нет ключа нужного типа). */
  toRow(item: T, position: number): Row | null;
  fromRow(row: Row): T;
  /** Есть служебная колонка updated_at «когда строка менялась» (не данные записи). */
  touchUpdatedAt: boolean;
  /**
   * Секретные значения (пароли Vibe): ошибки базы наружу и в лог — без текста запроса и параметров
   * (DrizzleQueryError кладёт params в message), только код ошибки Postgres.
   */
  sensitive?: boolean;
  /**
   * Аудит одной записи. По умолчанию: create — объект целиком, update — изменённые поля,
   * delete — объект целиком. Для секретов переопределяется (значения не пишутся).
   */
  audit?(change: KeyedChange<T>, reason: string | null): Pick<AuditEntry, 'action' | 'before' | 'after'> | null;
};

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export const asStored = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const col = (def: KeyedListDef<unknown>, prop: string) => (def.table as unknown as Record<string, any>)[prop];

export async function loadKeyedRows(q: Pick<Db, 'select'>, def: KeyedListDef<any>): Promise<Row[]> {
  return (await q
    .select()
    .from(def.table)
    .orderBy(asc(col(def, 'position')), asc(col(def, def.keyProp)))) as Row[];
}

export async function lockKeyedList(tx: Tx, def: KeyedListDef<any>) {
  await tx.execute(sql`select pg_advisory_xact_lock(${def.lockKey})`);
}

/** Позиции: старые записи сохраняют свою, новые (в конце) — следующие; если порядок поменялся — перенумеровать. */
export function assignPositions(nextKeys: Key[], prevPos: Map<Key, number>): number[] {
  let last = -1;
  let maxPrev = -1;
  for (const p of prevPos.values()) maxPrev = Math.max(maxPrev, p);
  let seenNew = false;
  let keep = true;
  for (const k of nextKeys) {
    const p = prevPos.get(k);
    if (p === undefined) {
      seenNew = true;
      continue;
    }
    if (seenNew || p <= last) {
      keep = false;
      break;
    }
    last = p;
  }
  if (!keep) return nextKeys.map((_, i) => i);
  let nextNew = maxPrev + 1;
  return nextKeys.map((k) => prevPos.get(k) ?? nextNew++);
}

/** Какие поля поменялись (для аудита). */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of keys) {
    if (JSON.stringify(before[k]) === JSON.stringify(after[k])) continue;
    b[k] = before[k];
    a[k] = after[k];
  }
  return { before: b, after: a };
}

function defaultAudit<T>(change: KeyedChange<T>, reason: string | null): Pick<AuditEntry, 'action' | 'before' | 'after'> {
  if (change.kind === 'create') return { action: 'create', after: { reason, ...(change.after as object) } };
  if (change.kind === 'delete') return { action: 'delete', before: change.before, after: reason ? { reason } : null };
  const diff = changedFields(change.before as Record<string, unknown>, change.after as Record<string, unknown>);
  return { action: 'update', before: diff.before, after: { reason, ...diff.after } };
}

async function applyDiff<T>(tx: Tx, def: KeyedListDef<T>, prevRows: Row[], nextItems: T[], ctx: KeyedListWriteContext) {
  const keyOf = (r: Row) => r[def.keyProp] as Key;
  const prevByKey = new Map(prevRows.map((r) => [keyOf(r), r]));
  const prevItems = new Map(prevRows.map((r) => [keyOf(r), def.fromRow(r)]));
  const stored = nextItems.map((i) => asStored(i));
  const rows = stored.map((item, i) => {
    const row = def.toRow(item, i);
    if (!row) throw new Error(`[${def.logTag}] запись отменена: запись №${i + 1} без ключа`);
    return row;
  });
  const positions = assignPositions(rows.map(keyOf), new Map(prevRows.map((r) => [keyOf(r), r.position as number])));
  const actor = { actorEmployeeId: ctx.actorEmployeeId ?? null };
  const reason = ctx.reason ?? null;
  const audits: AuditEntry[] = [];
  const upserts: Row[] = [];
  const nextKeys = new Set<Key>();
  const now = new Date();
  const pushAudit = (change: KeyedChange<T>) => {
    const a = (def.audit ?? defaultAudit)(change, reason);
    if (a) audits.push({ ...actor, entity: def.auditEntity, entityId: String(change.key), ...a });
  };

  rows.forEach((row, i) => {
    const key = keyOf(row);
    if (nextKeys.has(key)) throw new Error(`[${def.logTag}] запись отменена: дубль ключа`);
    nextKeys.add(key);
    row.position = positions[i]!;
    const prevRow = prevByKey.get(key);
    if (!prevRow) {
      upserts.push(row);
      pushAudit({ kind: 'create', key, after: stored[i]! });
      return;
    }
    const prevItem = prevItems.get(key)!;
    const sameData = JSON.stringify(prevItem) === JSON.stringify(stored[i]);
    if (sameData && prevRow.position === row.position) return;
    upserts.push(row);
    if (!sameData) pushAudit({ kind: 'update', key, before: prevItem, after: stored[i]! });
  });

  const removed = prevRows.filter((r) => !nextKeys.has(keyOf(r)));
  for (const r of removed) pushAudit({ kind: 'delete', key: keyOf(r), before: prevItems.get(keyOf(r))! });

  const keyCol = col(def, def.keyProp);
  for (const part of chunks(removed.map(keyOf), 1000)) await tx.delete(def.table).where(inArray(keyCol, part as never[]));
  for (const part of chunks(upserts)) {
    await tx
      .insert(def.table)
      .values((def.touchUpdatedAt ? part.map((r) => ({ ...r, updatedAt: now })) : part) as never)
      .onConflictDoUpdate({ target: keyCol, set: excludedSet(def.table, [def.keyProp]) });
  }
  for (const part of chunks(audits, 200)) await writeAudit(tx, part);
}

/** Ошибка без текста запроса и параметров: код Postgres (cause.code) или имя ошибки. */
export function redactDbError(err: unknown, tag: string): Error {
  const e = err as { cause?: { code?: string }; code?: string; name?: string; statusCode?: number };
  if (e && typeof e === 'object' && typeof e.statusCode === 'number') return err as Error; // createError из fn — как есть
  const code = e?.cause?.code || e?.code || e?.name || 'unknown';
  return new Error(`[${tag}] ошибка базы (${code})`);
}

export function createPgKeyedListRepo<T>(db: Db, def: KeyedListDef<T>): KeyedListRepo<T> {
  const enqueue = createMutationQueue();
  /** sensitive: ошибки базы — без параметров; ошибки самой fn (наш код, 400 и т.п.) — как есть. */
  const guard = async <R>(run: (own: (e: unknown) => unknown) => Promise<R>): Promise<R> => {
    const own = new Set<unknown>();
    try {
      return await run((e) => (own.add(e), e));
    } catch (err) {
      if (!def.sensitive || own.has(err)) throw err;
      throw redactDbError(err, def.logTag);
    }
  };
  return {
    backend: 'postgres',
    read: () => guard(async () => (await loadKeyedRows(db, def)).map((r) => def.fromRow(r))),
    mutate: <R>(fn: (items: T[]) => R | Promise<R>, ctx: KeyedListWriteContext = {}) =>
      enqueue(() =>
        guard((own) =>
          db.transaction(async (tx) => {
            await lockKeyedList(tx, def);
            const prevRows = await loadKeyedRows(tx, def);
            const items = prevRows.map((r) => def.fromRow(r));
            let result: R;
            try {
              result = await fn(items);
            } catch (err) {
              throw own(err);
            }
            await applyDiff(tx, def, prevRows, items, ctx);
            return result;
          })
        )
      ) as Promise<R>
  };
}

/** JSON-бэкенд с тем же контрактом: очередь в процессе, запись файла только если что-то поменялось. */
export function createJsonKeyedListRepo<T>(io: { read(): Promise<T[]>; write(items: T[]): Promise<void> }): KeyedListRepo<T> {
  const enqueue = createMutationQueue();
  return {
    backend: 'json',
    read: () => io.read(),
    mutate: <R>(fn: (items: T[]) => R | Promise<R>) =>
      enqueue(async () => {
        const items = await io.read();
        const before = JSON.stringify(items);
        const result = await fn(items);
        if (JSON.stringify(items) !== before) await io.write(items);
        return result;
      }) as Promise<R>
  };
}

// ---------- разовый импорт из JSON ----------

export type KeyedImportResult =
  | { source: string; status: 'already'; importedAt: string; fileCount: number; inserted: number; skipped: number }
  | { source: string; status: 'imported'; fileCount: number; inserted: number; skipped: number; verified: number };

/**
 * Разовый идемпотентный импорт списка из файла. Одна транзакция под advisory lock домена, маркер
 * в json_imports → повторный старт пропускает (удалённое не воскресает). Не годные записи (нет ключа,
 * дубль ключа) не кладём и считаем в skipped. Сверка: каждая положенная запись из базы совпадает
 * с файлом байт-в-байт (JSON.stringify), без пропусков — весь список с порядком.
 * В ошибках и аудите — только номера и счётчики, без значений (пароли Vibe).
 */
export async function importKeyedListFromJson<T>(
  db: Db,
  def: KeyedListDef<T>,
  opts: {
    source: string;
    jsonImports: PgTable;
    items: unknown[];
    /** Сколько записей было в файле (если часть отсеяна до вызова — больше items.length). */
    fileCount?: number;
  }
): Promise<KeyedImportResult> {
  const { source, items } = opts;
  const fileCount = opts.fileCount ?? items.length;
  const marker = opts.jsonImports as unknown as Record<string, any>;
  if (def.sensitive) {
    try {
      return await importKeyedTx(db, def, opts, source, items, fileCount, marker);
    } catch (err) {
      // свои ошибки сверки (только номера/счётчики) — как есть, ошибки базы — без параметров
      if (err instanceof Error && err.message.startsWith(`импорт ${source}:`)) throw err;
      throw redactDbError(err, def.logTag);
    }
  }
  return importKeyedTx(db, def, opts, source, items, fileCount, marker);
}

async function importKeyedTx<T>(
  db: Db,
  def: KeyedListDef<T>,
  opts: { jsonImports: PgTable },
  source: string,
  items: unknown[],
  fileCount: number,
  marker: Record<string, any>
): Promise<KeyedImportResult> {
  return db.transaction(async (tx) => {
    await lockKeyedList(tx, def);
    const [done] = (await tx.select().from(opts.jsonImports).where(eq(marker.source, source))) as {
      importedAt: Date;
      fileCount: number;
      inserted: number;
      skipped: number;
    }[];
    if (done) {
      return {
        source,
        status: 'already' as const,
        importedAt: done.importedAt.toISOString(),
        fileCount: done.fileCount,
        inserted: done.inserted,
        skipped: done.skipped
      };
    }
    const existing = await loadKeyedRows(tx, def);
    if (existing.length) throw new Error(`импорт ${source}: в таблице уже ${existing.length} строк без маркера импорта`);

    const kept: unknown[] = [];
    const rows: Row[] = [];
    const keys = new Set<Key>();
    for (const item of items) {
      const row = item && typeof item === 'object' && !Array.isArray(item) ? def.toRow(asStored(item) as T, rows.length) : null;
      if (!row) continue;
      const key = row[def.keyProp] as Key;
      if (keys.has(key)) continue;
      keys.add(key);
      kept.push(item);
      rows.push(row);
    }
    const skipped = fileCount - rows.length;
    let inserted = 0;
    for (const part of chunks(rows)) {
      inserted += ((await tx.insert(def.table).values(part as never).returning()) as unknown[]).length;
    }
    const fromDb = (await loadKeyedRows(tx, def)).map((r) => def.fromRow(r));
    if (fromDb.length !== kept.length) throw new Error(`импорт ${source}: в файле ${kept.length} записей, в базе ${fromDb.length}`);
    let verified = 0;
    kept.forEach((item, i) => {
      if (JSON.stringify(fromDb[i]) !== JSON.stringify(item)) throw new Error(`импорт ${source}: запись №${i + 1} в базе не совпала с файлом`);
      verified += 1;
    });
    await tx.insert(opts.jsonImports).values({ source, fileCount, inserted, skipped } as never);
    await writeAudit(tx, { action: 'import_json', entity: def.auditEntity, after: { source, fileCount, inserted, skipped } });
    return { source, status: 'imported' as const, fileCount, inserted, skipped, verified };
  });
}
