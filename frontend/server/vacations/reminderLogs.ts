import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { writeAudit } from '../db/audit';
import { chunks } from '../db/repositories/core';
import { isInt, isStr, mapFromColumns, mapToColumns, nullColumns, type FieldSpecs } from '../db/fieldMapping';
import { vacationManagerMonthReminders, vacationPreReminders, vacationsJsonImports } from '../db/schema';
import { createMutationQueue, writeJsonAtomic } from '../utils/atomicJson';

/**
 * Журналы отправленных напоминаний об отпусках (этап 5): защита cron от повторной отправки.
 * Два журнала одного вида — `{ version: 1, sent: [...] }` с уникальным `key`:
 * - pre-reminders: «за 3 недели до отпуска» (vacation-pre-reminders.json → vacations.pre_reminders);
 * - manager-month: руководителям «отпуска в месяце» (vacation-manager-month-reminders.json →
 *   vacations.manager_month_reminders).
 * Флаг тот же, что у отпусков: DB_VACATIONS=1.
 */
export type ReminderLogRecord = { key: string } & Record<string, unknown>;

export type ReminderLogWriteContext = { actorEmployeeId?: number | null; reason?: string };

export type ReminderLogRepo<R extends ReminderLogRecord> = {
  backend: 'json' | 'postgres';
  has(key: string): Promise<boolean>;
  /** Идемпотентно: запись с тем же key не дублируется. */
  record(row: R, ctx?: ReminderLogWriteContext): Promise<void>;
  /** Все записи в порядке файла. */
  readAll(): Promise<R[]>;
};

type ReminderTable = typeof vacationPreReminders | typeof vacationManagerMonthReminders;

export type ReminderLogKind = 'pre' | 'manager-month';

type LogDef = { table: ReminderTable; specs: FieldSpecs; source: string; entity: string };

const text = (col: string) => ({ col, ok: isStr });
const int = (col: string) => ({ col, ok: isInt });

export const REMINDER_LOGS: Record<ReminderLogKind, LogDef> = {
  pre: {
    table: vacationPreReminders,
    source: 'vacation-pre-reminders.json',
    entity: 'vacations.pre_reminder',
    specs: {
      kind: text('kind'),
      request_id: int('requestId'),
      employee: text('employee'),
      bitrix_user_id: int('bitrixUserId'),
      start: text('start'),
      end: text('end'),
      sent_at: text('sentAt'),
      channel: text('channel')
    }
  },
  'manager-month': {
    table: vacationManagerMonthReminders,
    source: 'vacation-manager-month-reminders.json',
    entity: 'vacations.manager_month_reminder',
    specs: {
      kind: text('kind'),
      target_month: text('targetMonth'),
      manager: text('manager'),
      bitrix_user_id: int('bitrixUserId'),
      vacation_count: int('vacationCount'),
      sent_at: text('sentAt'),
      channel: text('channel')
    }
  }
};

// ---------- JSON ----------

type StoreState<R> = { version: 1; sent: R[] };

/** Как раньше: нет файла / битый / не та версия → пустой журнал (файл не создаём до первой записи). */
export async function readReminderLogJson<R extends ReminderLogRecord>(path: string): Promise<R[]> {
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as StoreState<R>;
    if (!raw || raw.version !== 1 || !Array.isArray(raw.sent)) return [];
    return raw.sent;
  } catch {
    return [];
  }
}

/** Путь берётся при каждом вызове: его можно переопределить env (VACATION_*_FILE), как раньше. */
export function createJsonReminderLogRepo<R extends ReminderLogRecord>(path: () => string): ReminderLogRepo<R> {
  const enqueue = createMutationQueue();
  return {
    backend: 'json',
    has: async (key) => (await readReminderLogJson<R>(path())).some((row) => row.key === key),
    record: (row) =>
      enqueue(async () => {
        const sent = await readReminderLogJson<R>(path());
        if (sent.some((item) => item.key === row.key)) return;
        sent.push(row);
        await mkdir(dirname(path()), { recursive: true });
        await writeJsonAtomic(path(), { version: 1, sent } satisfies StoreState<R>);
      }),
    readAll: () => readReminderLogJson<R>(path())
  };
}

// ---------- Postgres ----------

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Свой advisory lock (не общий с отпусками): запись в журнал бывает из cron, который
 * может быть внутри правки отпусков, — общий ключ дал бы взаимную блокировку.
 */
export const REMINDER_LOGS_WRITE_LOCK_KEY = 72_461_006;

async function lockReminderLogs(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(${REMINDER_LOGS_WRITE_LOCK_KEY})`);
}

export function reminderToRow(def: LogDef, item: Record<string, unknown>, position: number) {
  if (!isStr(item.key) || !item.key) return null;
  const { cols, sourceKeys, extra } = mapToColumns(item, def.specs, ['key']);
  return { ...nullColumns(def.specs), ...cols, key: item.key, position, sourceKeys, extra };
}

export function rowToReminder<R extends ReminderLogRecord>(def: LogDef, row: Record<string, unknown>): R {
  return mapFromColumns(row, def.specs, row.sourceKeys as string[] | null, row.extra as Record<string, unknown> | null, {
    key: row.key
  }) as R;
}

async function loadRows(q: Pick<Db, 'select'>, def: LogDef) {
  const t = def.table;
  return (await q.select().from(t).orderBy(asc(t.position), asc(t.key))) as Record<string, unknown>[];
}

export function createPgReminderLogRepo<R extends ReminderLogRecord>(db: Db, kind: ReminderLogKind): ReminderLogRepo<R> {
  const def = REMINDER_LOGS[kind];
  const t = def.table;
  return {
    backend: 'postgres',
    async has(key) {
      const rows = await db.select({ key: t.key }).from(t).where(eq(t.key, key)).limit(1);
      return rows.length > 0;
    },
    async record(item, ctx = {}) {
      const stored = JSON.parse(JSON.stringify(item)) as Record<string, unknown>;
      await db.transaction(async (tx: Tx) => {
        await lockReminderLogs(tx);
        const [pos] = await tx.select({ n: sql<number>`coalesce(max(${t.position}) + 1, 0)::int` }).from(t);
        const row = reminderToRow(def, stored, pos?.n ?? 0);
        if (!row) throw new Error(`[vacations] журнал напоминаний: запись без key не сохраняется`);
        const inserted = await tx.insert(t).values(row as never).onConflictDoNothing().returning({ key: t.key });
        if (inserted.length) {
          await writeAudit(tx, {
            action: 'create',
            entity: def.entity,
            entityId: row.key,
            actorEmployeeId: ctx.actorEmployeeId ?? null,
            after: { reason: ctx.reason ?? 'cron', ...stored }
          });
        }
      });
    },
    async readAll() {
      return (await loadRows(db, def)).map((r) => rowToReminder<R>(def, r));
    }
  };
}

// ---------- импорт ----------

export type ReminderLogImportResult =
  | { source: string; status: 'already'; importedAt: string; fileCount: number; inserted: number; skipped: number }
  | { source: string; status: 'imported'; fileCount: number; inserted: number; skipped: number; verified: number };

/**
 * Разовый идемпотентный импорт журнала напоминаний → схема vacations. Нет файла → 0 записей
 * (на стейдже файлов может не быть). Под advisory lock журналов; маркер в
 * vacations.json_imports; сверка каждой записи поле-в-поле и всего журнала (порядок). Файл не трогаем.
 */
export async function importReminderLogFromJson(
  db: Db,
  kind: ReminderLogKind,
  file: string,
  source: string = REMINDER_LOGS[kind].source
): Promise<ReminderLogImportResult> {
  const def = REMINDER_LOGS[kind];
  return db.transaction(async (tx) => {
    await lockReminderLogs(tx);
    const [done] = await tx.select().from(vacationsJsonImports).where(eq(vacationsJsonImports.source, source));
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
    const items = await readReminderLogJson<ReminderLogRecord>(file);
    const rows: NonNullable<ReturnType<typeof reminderToRow>>[] = [];
    const originals = new Map<string, unknown>();
    let skipped = 0;
    for (const item of items) {
      const row = reminderToRow(def, item, rows.length);
      if (!row || originals.has(row.key)) {
        skipped += 1;
        continue;
      }
      originals.set(row.key, item);
      rows.push(row);
    }
    let inserted = 0;
    for (const part of chunks(rows)) {
      inserted += (await tx.insert(def.table).values(part as never).onConflictDoNothing().returning({ key: def.table.key })).length;
    }
    const dbRows = await loadRows(tx, def);
    const byKey = new Map(dbRows.map((r) => [r.key as string, r]));
    let verified = 0;
    for (const [key, original] of originals) {
      const row = byKey.get(key);
      if (!row || JSON.stringify(rowToReminder(def, row)) !== JSON.stringify(original)) {
        throw new Error(`импорт ${source}: запись key=${key} в базе не совпала с файлом`);
      }
      verified += 1;
    }
    if (!skipped && JSON.stringify(dbRows.map((r) => rowToReminder(def, r))) !== JSON.stringify(items)) {
      throw new Error(`импорт ${source}: журнал из базы не совпал с файлом`);
    }
    await tx.insert(vacationsJsonImports).values({ source, fileCount: items.length, inserted, skipped });
    await writeAudit(tx, { action: 'import_json', entity: def.entity, after: { source, fileCount: items.length, inserted, skipped } });
    return { source, status: 'imported' as const, fileCount: items.length, inserted, skipped, verified };
  });
}
