import { eq, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { getDb, type Db } from '../client';
import { writeAudit } from '../audit';
import { mapFromColumns, mapToColumns, nullColumns, type FieldSpecs } from '../fieldMapping';
import { createMutationQueue } from '../../utils/atomicJson';
import { chunks, excludedSet } from './core';
import {
  applyDiff,
  asStored,
  changedFields,
  loadKeyedRows,
  type KeyedListDef,
  type KeyedListWriteContext,
  type Tx
} from './keyedList';

/**
 * Этап 7: Postgres-репозиторий для «файла-состояния» — объект верхнего уровня, в котором есть
 * списки записей с ключом и счётчики (ideas.json: ideas + votesByUserId + nextIdeaId;
 * knowledge-articles.json: articles + nextId).
 * - каждый список — своя таблица (KeyedListDef, запись diff-ом и аудит как в keyedList);
 * - всё остальное (счётчики, неизвестные ключи, порядок ключей) — одна строка state (id=1)
 *   с source_keys + extra, объект из базы байт-в-байт как файл;
 * - mutate: очередь в процессе + транзакция под advisory lock домена, ошибка fn → ничего не записано;
 * - чтение из кэша процесса (все записи идут через этот процесс и обновляют кэш сразу, TTL —
 *   только чтобы подхватить ручную правку в базе); наружу — копия.
 */

export type RawState = Record<string, unknown>;

export type StatePart = {
  /** Ключ верхнего уровня в файле. */
  prop: string;
  def: KeyedListDef<any>;
  /** Значение из файла → записи списка; null — не список (лежит в extra как есть). */
  toItems(value: unknown): unknown[] | null;
  fromItems(items: unknown[]): unknown;
};

export type KeyedStateDef = {
  lockKey: number;
  logTag: string;
  /** Сущность аудита для строки state (счётчики). */
  auditEntity: string;
  metaTable: PgTable;
  metaFields: FieldSpecs;
  /** Первый — основной список (по нему fileCount / inserted / skipped в json_imports). */
  parts: StatePart[];
  /** Нормализация стора (для сверки импорта, если часть записей не легла). */
  normalize(raw: RawState): unknown;
};

export type StateRepo = {
  backend: 'json' | 'postgres';
  /** Сырой объект, как в файле. */
  read(): Promise<RawState>;
  /** fn получает копию состояния и возвращает следующее. Правки строго по очереди. */
  mutate<R>(fn: (raw: RawState) => Promise<{ next: RawState; result: R }>, ctx?: KeyedListWriteContext): Promise<R>;
};

type Row = Record<string, unknown>;
const META_ID = 1;

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Значение верхнего уровня как список: массив как есть. */
export const arrayPart = (prop: string, def: KeyedListDef<any>): StatePart => ({
  prop,
  def,
  toItems: (v) => (Array.isArray(v) ? v : null),
  fromItems: (items) => items
});

type Split = { lists: Map<string, unknown[]>; meta: Row };

/** Объект файла → списки + строка state. */
export function splitState(def: KeyedStateDef, raw: unknown): Split {
  const obj = isPlainObject(raw) ? raw : {};
  const lists = new Map<string, unknown[]>();
  const metaObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const part = def.parts.find((p) => p.prop === key);
    const items = part ? part.toItems(value) : null;
    if (items) {
      lists.set(key, items);
      metaObj[key] = true; // место ключа в source_keys; само значение — в таблице списка
    } else {
      metaObj[key] = value;
    }
  }
  const { cols, sourceKeys, extra } = mapToColumns(metaObj, def.metaFields, [...lists.keys()]);
  return { lists, meta: { ...nullColumns(def.metaFields), ...cols, id: META_ID, sourceKeys, extra } };
}

/** Строка state + списки → объект с теми же ключами в том же порядке. */
export function assembleState(def: KeyedStateDef, meta: Row | undefined, lists: Map<string, unknown[]>): RawState {
  // пустой объект в файле ({}): ни одного ключа верхнего уровня
  if (!meta || (Array.isArray(meta.sourceKeys) && !meta.sourceKeys.length && !meta.extra)) return {};
  const fixed: Record<string, unknown> = {};
  for (const part of def.parts) fixed[part.prop] = part.fromItems(lists.get(part.prop) ?? []);
  return mapFromColumns(meta, def.metaFields, meta.sourceKeys as string[] | null, meta.extra as Row | null, fixed);
}

type Loaded = { meta: Row | undefined; rows: Map<string, Row[]> };

async function loadAll(q: Pick<Db, 'select'>, def: KeyedStateDef): Promise<Loaded> {
  const metaId = (def.metaTable as unknown as Record<string, any>).id;
  const [meta] = (await q.select().from(def.metaTable).where(eq(metaId, META_ID))) as Row[];
  const rows = new Map<string, Row[]>();
  for (const part of def.parts) rows.set(part.prop, await loadKeyedRows(q, part.def));
  return { meta, rows };
}

function toState(def: KeyedStateDef, loaded: Loaded): RawState {
  const lists = new Map<string, unknown[]>();
  for (const part of def.parts) lists.set(part.prop, (loaded.rows.get(part.prop) ?? []).map((r) => part.def.fromRow(r)));
  return assembleState(def, loaded.meta, lists);
}

async function lockState(tx: Tx, def: KeyedStateDef) {
  await tx.execute(sql`select pg_advisory_xact_lock(${def.lockKey})`);
}

/** Объект строки state без служебных колонок (для сравнения и аудита). */
function metaData(def: KeyedStateDef, meta: Row | undefined): Row {
  if (!meta) return {};
  // порядок ключей верхнего уровня — тоже данные файла
  return {
    keys: meta.sourceKeys ?? null,
    ...mapFromColumns(meta, def.metaFields, meta.sourceKeys as string[] | null, meta.extra as Row | null)
  };
}

export const STATE_CACHE_TTL_MS = 30_000;

export function createPgStateRepo(db: Db, def: KeyedStateDef, opts: { cacheTtlMs?: number } = {}): StateRepo {
  const ttl = opts.cacheTtlMs ?? STATE_CACHE_TTL_MS;
  const enqueue = createMutationQueue();
  let cache: { value: RawState; at: number } | null = null;
  let version = 0;

  return {
    backend: 'postgres',
    async read() {
      if (cache && Date.now() - cache.at < ttl) return structuredClone(cache.value);
      const v0 = version;
      const value = toState(def, await loadAll(db, def));
      if (v0 === version) cache = { value, at: Date.now() };
      return structuredClone(value);
    },
    mutate: <R>(fn: (raw: RawState) => Promise<{ next: RawState; result: R }>, ctx: KeyedListWriteContext = {}) =>
      enqueue(async () => {
        version += 1;
        cache = null;
        const { next, result } = await db.transaction(async (tx) => {
          await lockState(tx, def);
          const loaded = await loadAll(tx, def);
          const out = await fn(toState(def, loaded)); // toState собирает свежие объекты
          const stored = asStored(out.next);
          const split = splitState(def, stored);
          for (const part of def.parts) {
            await applyDiff(tx, part.def, loaded.rows.get(part.prop) ?? [], split.lists.get(part.prop) ?? [], ctx);
          }
          const before = metaData(def, loaded.meta);
          const after = metaData(def, split.meta);
          if (!loaded.meta || JSON.stringify(before) !== JSON.stringify(after)) {
            await tx
              .insert(def.metaTable)
              .values({ ...split.meta, updatedAt: new Date() } as never)
              .onConflictDoUpdate({ target: (def.metaTable as unknown as Record<string, any>).id, set: excludedSet(def.metaTable, ['id']) });
            const { keys: _kb, ...b } = before;
            const { keys: _ka, ...a } = after;
            const diff = changedFields(b, a);
            await writeAudit(tx, {
              action: loaded.meta ? 'update' : 'create',
              entity: def.auditEntity,
              entityId: String(META_ID),
              actorEmployeeId: ctx.actorEmployeeId ?? null,
              before: loaded.meta ? diff.before : null,
              after: { reason: ctx.reason ?? null, ...diff.after }
            });
          }
          return { next: stored, result: out.result };
        });
        version += 1;
        cache = { value: next, at: Date.now() };
        return result;
      }) as Promise<R>
  };
}

/** JSON-бэкенд с тем же контрактом: очередь в процессе, запись файла только если что-то поменялось. */
export function createJsonStateRepo(io: { read(): Promise<RawState>; write(raw: RawState): Promise<void> }): StateRepo {
  const enqueue = createMutationQueue();
  return {
    backend: 'json',
    read: () => io.read(),
    mutate: <R>(fn: (raw: RawState) => Promise<{ next: RawState; result: R }>) =>
      enqueue(async () => {
        const raw = await io.read();
        const before = JSON.stringify(raw);
        const { next, result } = await fn(raw);
        if (JSON.stringify(next) !== before) await io.write(next);
        return result;
      }) as Promise<R>
  };
}

// ---------- флаг + готовность ----------

/**
 * Где живёт домен: флаг стенда и импорт прошёл → Postgres, иначе JSON-файл.
 * Готовность выставляет плагин db-migrate после разового импорта.
 */
export function createStateGate(opts: {
  label: string;
  logTag: string;
  flag: () => boolean;
  def: KeyedStateDef;
  makeJson: () => StateRepo;
}) {
  let resolveReady!: (ok: boolean) => void;
  const ready = new Promise<boolean>((resolve) => {
    resolveReady = resolve;
  });
  let jsonRepo: StateRepo | null = null;
  let pgRepo: StateRepo | null = null;
  let warned = false;
  return {
    setReady: (ok: boolean) => resolveReady(ok),
    /** Тот же Postgres-репозиторий (и кэш), что отдаст repo(); для шагов старта до setReady. */
    pg: (db: Db): StateRepo => (pgRepo ??= createPgStateRepo(db, opts.def)),
    async repo(): Promise<StateRepo> {
      if (opts.flag()) {
        const ok = await ready;
        const db = ok ? getDb() : null;
        if (db) return (pgRepo ??= createPgStateRepo(db, opts.def));
        if (!warned) {
          warned = true;
          console.error(`[${opts.logTag}] флаг стоит, но ${opts.label} не на Postgres — работаем на JSON-файле`);
        }
      }
      return (jsonRepo ??= opts.makeJson());
    }
  };
}

// ---------- разовый импорт из JSON ----------

export type StateImportResult =
  | { source: string; status: 'already'; importedAt: string; fileCount: number; inserted: number; skipped: number }
  | {
      source: string;
      status: 'imported';
      fileCount: number;
      inserted: number;
      skipped: number;
      verified: number;
      /** Строк в каждой таблице списка. */
      parts: Record<string, number>;
    };

/**
 * Разовый идемпотентный импорт файла-состояния. Одна транзакция под advisory lock домена,
 * маркер в json_imports → повторный старт пропускает (удалённое не воскресает).
 * Записи без ключа / с дублем ключа не кладём (skipped). Сверка: каждая положенная запись
 * совпадает с файлом поле-в-поле, весь объект — байт-в-байт; если что-то отсеяно —
 * результат нормализации стора (то, что видит API) совпадает с файлом.
 */
export async function importStateFromJson(
  db: Db,
  def: KeyedStateDef,
  opts: { source: string; jsonImports: PgTable; raw: unknown }
): Promise<StateImportResult> {
  const { source } = opts;
  const marker = opts.jsonImports as unknown as Record<string, any>;
  return db.transaction(async (tx) => {
    await lockState(tx, def);
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
    const existing = await loadAll(tx, def);
    const busy = existing.meta ? 1 : [...existing.rows.values()].reduce((n, r) => n + r.length, 0);
    if (busy) throw new Error(`импорт ${source}: в таблицах уже есть строки без маркера импорта`);

    const raw = isPlainObject(opts.raw) ? (asStored(opts.raw) as RawState) : {};
    const split = splitState(def, raw);
    const kept = new Map<string, unknown[]>();
    const counts: Record<string, { file: number; inserted: number; skipped: number }> = {};
    for (const part of def.parts) {
      const items = split.lists.get(part.prop) ?? [];
      const keys = new Set<unknown>();
      const rows: Row[] = [];
      const keepItems: unknown[] = [];
      for (const item of items) {
        const row = isPlainObject(item) ? part.def.toRow(item, rows.length) : null;
        if (!row) continue;
        const key = row[part.def.keyProp];
        if (keys.has(key)) continue;
        keys.add(key);
        rows.push(row);
        keepItems.push(item);
      }
      let inserted = 0;
      for (const chunk of chunks(rows)) {
        inserted += ((await tx.insert(part.def.table).values(chunk as never).returning()) as unknown[]).length;
      }
      kept.set(part.prop, keepItems);
      counts[part.prop] = { file: items.length, inserted, skipped: items.length - rows.length };
    }
    await tx.insert(def.metaTable).values(split.meta as never);

    // сверка поле-в-поле
    const loaded = await loadAll(tx, def);
    let verified = 0;
    for (const part of def.parts) {
      const fromDb = (loaded.rows.get(part.prop) ?? []).map((r) => part.def.fromRow(r) as Row);
      const want = kept.get(part.prop) ?? [];
      if (fromDb.length !== want.length) {
        throw new Error(`импорт ${source}: ${part.prop} в файле ${want.length}, в базе ${fromDb.length}`);
      }
      want.forEach((item, i) => {
        const got = fromDb[i]!;
        const w = item as Row;
        const keys = Object.keys(w);
        if (JSON.stringify(Object.keys(got)) !== JSON.stringify(keys)) {
          throw new Error(`импорт ${source}: ${part.prop} №${i + 1} — другой набор полей`);
        }
        for (const k of keys) {
          if (JSON.stringify(got[k]) !== JSON.stringify(w[k])) {
            throw new Error(`импорт ${source}: ${part.prop} №${i + 1} поле ${k} в базе не совпало с файлом`);
          }
        }
        verified += 1;
      });
    }
    const fromDbState = toState(def, loaded);
    const skippedAny = Object.values(counts).some((c) => c.skipped > 0);
    if (!skippedAny) {
      if (JSON.stringify(fromDbState) !== JSON.stringify(raw)) throw new Error(`импорт ${source}: объект из базы не совпал с файлом`);
    } else if (JSON.stringify(def.normalize(fromDbState)) !== JSON.stringify(def.normalize(raw))) {
      throw new Error(`импорт ${source}: отсеянные записи меняют то, что видит API — импорт отменён`);
    }

    const main = counts[def.parts[0]!.prop]!;
    await tx.insert(opts.jsonImports).values({ source, fileCount: main.file, inserted: main.inserted, skipped: main.skipped } as never);
    await writeAudit(tx, {
      action: 'import_json',
      entity: def.auditEntity,
      after: { source, ...Object.fromEntries(Object.entries(counts).map(([k, c]) => [k, c])) }
    });
    return {
      source,
      status: 'imported' as const,
      fileCount: main.file,
      inserted: main.inserted,
      skipped: main.skipped,
      verified,
      parts: Object.fromEntries(Object.entries(counts).map(([k, c]) => [k, c.inserted]))
    };
  });
}
