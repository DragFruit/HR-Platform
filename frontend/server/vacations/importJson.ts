import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { writeAudit } from '../db/audit';
import { chunks } from '../db/repositories/core';
import { loadVacationRows, lockVacations } from '../db/repositories/vacations';
import { vacationRequests, vacationReservations, vacationState, vacationsJsonImports } from '../db/schema';
import { normalizeVacationStoreState } from '../utils/vacationsStore';
import { readVacationsJson } from './jsonStore';
import { rowToRequest, rowToReservation, rowsToState, stateToRows } from './rowMapping';

export const VACATIONS_IMPORT_SOURCE = 'vacations.json';

export type VacationsImportResult =
  | { status: 'already'; importedAt: string; fileCount: number; inserted: number; skipped: number }
  | {
      status: 'imported';
      /** Заявок + броней в файле. */
      fileCount: number;
      requests: number;
      reservations: number;
      inserted: number;
      skipped: number;
      /** Сколько записей прочитано из базы и совпало с файлом поле-в-поле. */
      verified: number;
    };

/**
 * Разовый идемпотентный импорт vacations.json → схема vacations.
 * Одна транзакция под тем же advisory lock, что и запись отпусков: либо всё, либо ничего
 * (тогда домен остаётся на JSON). Маркер в vacations.json_imports → повторный старт пропускает
 * (иначе удалённые в базе заявки воскресали бы). Файл не трогаем — он остаётся бэкапом.
 * Сверка: каждая заявка и бронь из базы совпадает с объектом файла байт-в-байт (JSON.stringify),
 * и всё состояние, прочитанное из базы, совпадает с файлом.
 */
export async function importVacationsFromJson(
  db: Db,
  file: string,
  source: string = VACATIONS_IMPORT_SOURCE
): Promise<VacationsImportResult> {
  return db.transaction(async (tx) => {
    await lockVacations(tx);
    const [done] = await tx.select().from(vacationsJsonImports).where(eq(vacationsJsonImports.source, source));
    if (done) {
      return {
        status: 'already' as const,
        importedAt: done.importedAt.toISOString(),
        fileCount: done.fileCount,
        inserted: done.inserted,
        skipped: done.skipped
      };
    }

    const raw = await readVacationsJson(file);
    const rows = stateToRows(raw);
    const fileCount =
      Object.values(raw.requestsByYear ?? {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0) +
      Object.values(raw.reservationsByYear ?? {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);

    let inserted = 0;
    for (const part of chunks(rows.requests)) {
      inserted += (await tx.insert(vacationRequests).values(part).onConflictDoNothing().returning({ id: vacationRequests.id })).length;
    }
    for (const part of chunks(rows.reservations)) {
      inserted += (await tx.insert(vacationReservations).values(part).onConflictDoNothing().returning({ id: vacationReservations.id })).length;
    }
    await tx.insert(vacationState).values(rows.state).onConflictDoNothing();

    // Сверка поле-в-поле.
    const dbRows = await loadVacationRows(tx);
    const reqById = new Map(dbRows.requests.map((r) => [r.id, r]));
    const resById = new Map(dbRows.reservations.map((r) => [r.id, r]));
    let verified = 0;
    for (const [year, list] of Object.entries(raw.requestsByYear ?? {})) {
      for (const item of Array.isArray(list) ? list : []) {
        const row = reqById.get((item as { id: number }).id);
        if (!row) continue; // попал в skipped (без id / дубль)
        if (row.bucketYear !== year || JSON.stringify(rowToRequest(row)) !== JSON.stringify(item)) {
          if (rows.skipped.some((s) => s.kind === 'request' && s.id === item.id)) continue; // дубль: в базе первая копия
          throw new Error(`импорт отпусков: заявка id=${item.id} в базе не совпала с файлом`);
        }
        verified += 1;
      }
    }
    for (const [year, list] of Object.entries(raw.reservationsByYear ?? {})) {
      for (const item of Array.isArray(list) ? list : []) {
        const row = resById.get((item as { id: number }).id);
        if (!row) continue;
        if (row.bucketYear !== year || JSON.stringify(rowToReservation(row)) !== JSON.stringify(item)) {
          if (rows.skipped.some((s) => s.kind === 'reservation' && s.id === item.id)) continue;
          throw new Error(`импорт отпусков: бронь id=${item.id} в базе не совпала с файлом`);
        }
        verified += 1;
      }
    }
    if (!rows.skipped.length) {
      // Как отдаёт API (после нормализации; порядок ключей верхнего уровня задаёт нормализатор).
      const fromDb = JSON.stringify(normalizeVacationStoreState(rowsToState(dbRows.state, dbRows.requests, dbRows.reservations)));
      if (fromDb !== JSON.stringify(normalizeVacationStoreState(raw))) throw new Error('импорт отпусков: состояние из базы не совпало с файлом');
    }

    const skipped = rows.skipped.length;
    await tx.insert(vacationsJsonImports).values({ source, fileCount, inserted, skipped });
    await writeAudit(tx, {
      action: 'import_json',
      entity: 'vacations',
      after: {
        source,
        fileCount,
        inserted,
        skipped,
        skippedIds: rows.skipped,
        primaryYear: rows.state.primaryYear,
        nextRequestId: rows.state.nextRequestId,
        nextReservationId: rows.state.nextReservationId
      }
    });
    return {
      status: 'imported' as const,
      fileCount,
      requests: rows.requests.length,
      reservations: rows.reservations.length,
      inserted,
      skipped,
      verified
    };
  });
}
