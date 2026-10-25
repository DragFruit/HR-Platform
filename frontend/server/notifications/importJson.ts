import { eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { writeAudit } from '../db/audit';
import { jsonImports, userNotifications } from '../db/schema';
import { readUserNotificationsJson } from './jsonStore';
import { notificationToRow } from './rowMapping';

export const NOTIFICATIONS_IMPORT_SOURCE = 'user-notifications.json';
/** pg_advisory_xact_lock для импорта (два процесса на одной базе не импортируют одновременно). */
export const NOTIFICATIONS_IMPORT_LOCK_KEY = 72_461_002;

export type NotificationsImportResult =
  | { status: 'already'; importedAt: string; fileCount: number; inserted: number; skipped: number }
  | {
      status: 'imported';
      fileCount: number;
      inserted: number;
      /** Уже были в базе (повтор после сбоя) — не дублируются. */
      existing: number;
      /** Не положены: нет валидного id / получателя / даты — данные не выдумываем. */
      skipped: number;
      /** Сколько id из файла реально найдено в базе после импорта. */
      verifiedInDb: number;
    };

/**
 * Разовый идемпотентный импорт JSON → notifications.user_notifications.
 * Повторный старт: маркер в notifications.json_imports → пропуск (иначе удалённые в базе
 * уведомления воскресали бы из бэкапа). Файл не трогаем — он остаётся бэкапом.
 */
export async function importUserNotificationsFromJson(
  db: Db,
  file: string,
  source = NOTIFICATIONS_IMPORT_SOURCE
): Promise<NotificationsImportResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${NOTIFICATIONS_IMPORT_LOCK_KEY})`);

    const [done] = await tx.select().from(jsonImports).where(eq(jsonImports.source, source));
    if (done) {
      return {
        status: 'already' as const,
        importedAt: done.importedAt.toISOString(),
        fileCount: done.fileCount,
        inserted: done.inserted,
        skipped: done.skipped
      };
    }

    const items = await readUserNotificationsJson(file);
    const rows = [];
    let skipped = 0;
    const seenIds = new Set<string>();
    for (const item of items) {
      const row = notificationToRow(item as unknown as Record<string, unknown>);
      if (!row || seenIds.has(row.id)) {
        skipped += 1;
        continue;
      }
      seenIds.add(row.id);
      rows.push(row);
    }

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const res = await tx
        .insert(userNotifications)
        .values(chunk)
        .onConflictDoNothing({ target: userNotifications.id })
        .returning({ id: userNotifications.id });
      inserted += res.length;
    }

    let verifiedInDb = 0;
    const ids = [...seenIds];
    for (let i = 0; i < ids.length; i += 1000) {
      const [row] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(userNotifications)
        .where(inArray(userNotifications.id, ids.slice(i, i + 1000)));
      verifiedInDb += row?.n ?? 0;
    }
    if (verifiedInDb !== rows.length) {
      throw new Error(`импорт уведомлений: в файле ${rows.length} валидных, в базе найдено ${verifiedInDb}`);
    }

    await tx.insert(jsonImports).values({
      source,
      fileCount: items.length,
      inserted,
      skipped
    });
    await writeAudit(tx, {
      action: 'import_json',
      entity: 'notifications.user_notifications',
      after: { source, fileCount: items.length, inserted, existing: rows.length - inserted, skipped }
    });

    return {
      status: 'imported' as const,
      fileCount: items.length,
      inserted,
      existing: rows.length - inserted,
      skipped,
      verifiedInDb
    };
  });
}
