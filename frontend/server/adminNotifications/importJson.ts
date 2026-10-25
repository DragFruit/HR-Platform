import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { writeAudit } from '../db/audit';
import { chunks } from '../db/repositories/core';
import { ADMIN_NOTIFICATION_AUDIT_ENTITY, loadAdminNotificationRows, lockAdminNotifications } from '../db/repositories/adminNotifications';
import { adminNotifications, jsonImports } from '../db/schema';
import { readAdminNotificationsJson } from './jsonStore';
import { adminNotificationToRow, rowToAdminNotification } from './rowMapping';

export const ADMIN_NOTIFICATIONS_IMPORT_SOURCE = 'admin-notifications.json';

export type AdminNotificationsImportResult =
  | { status: 'already'; importedAt: string; fileCount: number; inserted: number; skipped: number }
  | {
      status: 'imported';
      fileCount: number;
      inserted: number;
      /** Не положены: нет строкового id / kind или дубль id — данные не выдумываем. */
      skipped: number;
      /** Сколько записей прочитано из базы и совпало с файлом поле-в-поле. */
      verified: number;
      unseen: number;
    };

/**
 * Разовый идемпотентный импорт admin-notifications.json → notifications.admin_notifications.
 * Одна транзакция под тем же advisory lock, что и запись: либо всё, либо ничего (тогда домен остаётся
 * на JSON). Маркер в notifications.json_imports → повторный старт пропускает (иначе удалённое
 * воскресало бы). Нет файла → 0 записей. Файл не трогаем — он остаётся бэкапом.
 * Сверка: каждая запись из базы совпадает с объектом файла байт-в-байт (JSON.stringify),
 * весь список (порядок) и число непрочитанных — тоже.
 */
export async function importAdminNotificationsFromJson(
  db: Db,
  file: string,
  source = ADMIN_NOTIFICATIONS_IMPORT_SOURCE
): Promise<AdminNotificationsImportResult> {
  return db.transaction(async (tx) => {
    await lockAdminNotifications(tx);
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

    const items = await readAdminNotificationsJson(file);
    const rows = [];
    const originals = new Map<string, unknown>();
    let skipped = 0;
    for (const item of items) {
      const row = adminNotificationToRow(item as unknown as Record<string, unknown>, rows.length);
      if (!row || originals.has(row.id)) {
        skipped += 1;
        continue;
      }
      row.seenAt = null; // когда прочитано до переезда — неизвестно
      originals.set(row.id, item);
      rows.push(row);
    }

    let inserted = 0;
    for (const part of chunks(rows)) {
      inserted += (await tx.insert(adminNotifications).values(part).onConflictDoNothing().returning({ id: adminNotifications.id })).length;
    }

    const dbRows = await loadAdminNotificationRows(tx);
    const byId = new Map(dbRows.map((r) => [r.id, r]));
    let verified = 0;
    for (const [id, original] of originals) {
      const row = byId.get(id);
      if (!row || JSON.stringify(rowToAdminNotification(row)) !== JSON.stringify(original)) {
        throw new Error(`импорт уведомлений админки: запись id=${id} в базе не совпала с файлом`);
      }
      verified += 1;
    }
    if (!skipped && JSON.stringify(dbRows.map(rowToAdminNotification)) !== JSON.stringify(items)) {
      throw new Error('импорт уведомлений админки: список из базы не совпал с файлом');
    }
    const [cnt] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(adminNotifications)
      .where(sql`${adminNotifications.adminSeen} is not true`);
    const unseen = cnt?.n ?? 0;
    const unseenInFile = [...originals.values()].filter((i) => !(i as { admin_seen?: unknown }).admin_seen).length;
    if (unseen !== unseenInFile) {
      throw new Error(`импорт уведомлений админки: непрочитанных в файле ${unseenInFile}, в базе ${unseen}`);
    }

    await tx.insert(jsonImports).values({ source, fileCount: items.length, inserted, skipped });
    await writeAudit(tx, {
      action: 'import_json',
      entity: ADMIN_NOTIFICATION_AUDIT_ENTITY,
      after: { source, fileCount: items.length, inserted, skipped, unseen }
    });
    return { status: 'imported' as const, fileCount: items.length, inserted, skipped, verified, unseen };
  });
}
