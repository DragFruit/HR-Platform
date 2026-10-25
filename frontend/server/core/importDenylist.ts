import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { writeAudit } from '../db/audit';
import { chunks } from '../db/repositories/core';
import { ACCESS_DENYLIST_AUDIT_ENTITY, loadDenylistRows, lockAccessDenylist } from '../db/repositories/accessDenylist';
import { accessDenylist, coreJsonImports } from '../db/schema';
import { denylistEntryToRow, readAccessDenylistJson, rowToDenylistEntry } from './accessDenylistStore';

export const ACCESS_DENYLIST_IMPORT_SOURCE = 'employee-access-denylist.json';

export type AccessDenylistImportResult =
  | { source: string; status: 'already'; importedAt: string; fileCount: number; inserted: number; skipped: number }
  | { source: string; status: 'imported'; fileCount: number; inserted: number; skipped: number; verified: number };

/**
 * Разовый идемпотентный импорт employee-access-denylist.json → core.access_denylist.
 * Отдельная транзакция (не общая с импортом сотрудников этапа 3) под advisory lock стоп-листа,
 * маркер в core.json_imports. Нет файла → 0 записей. Сверка: каждая запись (по порядку) из базы
 * совпадает с файлом байт-в-байт. Файл не удаляем: дальше он обновляется как JSON-зеркало.
 */
export async function importAccessDenylistFromJson(
  db: Db,
  file: string,
  source = ACCESS_DENYLIST_IMPORT_SOURCE
): Promise<AccessDenylistImportResult> {
  return db.transaction(async (tx) => {
    await lockAccessDenylist(tx);
    const [done] = await tx.select().from(coreJsonImports).where(eq(coreJsonImports.source, source));
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
    const items = await readAccessDenylistJson(file);
    const kept: unknown[] = [];
    const rows = [];
    for (const item of items) {
      const row = denylistEntryToRow(item, rows.length);
      if (!row) continue;
      kept.push(item);
      rows.push(row);
    }
    const skipped = items.length - rows.length;
    const existing = await loadDenylistRows(tx);
    if (existing.length) {
      throw new Error(`импорт стоп-листа: в core.access_denylist уже ${existing.length} строк без маркера импорта`);
    }
    let inserted = 0;
    for (const part of chunks(rows)) {
      inserted += (await tx.insert(accessDenylist).values(part).returning({ id: accessDenylist.id })).length;
    }
    const fromDb = (await loadDenylistRows(tx)).map(rowToDenylistEntry);
    if (fromDb.length !== kept.length) {
      throw new Error(`импорт стоп-листа: в файле ${kept.length} записей, в базе ${fromDb.length}`);
    }
    let verified = 0;
    kept.forEach((item, i) => {
      if (JSON.stringify(fromDb[i]) !== JSON.stringify(item)) {
        throw new Error(`импорт стоп-листа: запись №${i + 1} в базе не совпала с файлом`);
      }
      verified += 1;
    });
    await tx.insert(coreJsonImports).values({ source, fileCount: items.length, inserted, skipped });
    await writeAudit(tx, { action: 'import_json', entity: ACCESS_DENYLIST_AUDIT_ENTITY, after: { source, fileCount: items.length, inserted, skipped } });
    return { source, status: 'imported' as const, fileCount: items.length, inserted, skipped, verified };
  });
}
