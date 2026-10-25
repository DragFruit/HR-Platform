import { eq, sql } from 'drizzle-orm';
import { isDeepStrictEqual } from 'node:util';
import type { Db } from '../db/client';
import { writeAudit } from '../db/audit';
import { CORE_WRITE_LOCK_KEY } from '../db/repositories/core';
import {
  coreJsonImports,
  employeeAssignmentHistory,
  employees,
  managerAssignments,
  managerAssignmentsByName,
  orgExecutives,
  orgGroups,
  orgLinks,
  orgUnits
} from '../db/schema';
import { normalizeOrgStructureState } from '../utils/orgStructureStore';
import { readEmployeesJson, readManagerAssignmentsJson, readOrgStructureJson, type CoreJsonFiles } from './jsonStore';
import { assignmentOf, employeeToRow, orgRowsToState, orgStateToRows, rowToEmployee, type OrgRows } from './rowMapping';

export const CORE_IMPORT_SOURCES = {
  employees: 'employees.json',
  managers: 'employee-managers.json',
  org: 'org-structure.json'
} as const;

export type CoreImportPart =
  | { source: string; status: 'already'; importedAt: string; fileCount: number; inserted: number; skipped: number }
  | { source: string; status: 'imported'; fileCount: number; inserted: number; skipped: number; verified: number };

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

function chunks<T>(list: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function marker(tx: Tx, source: string) {
  const [done] = await tx.select().from(coreJsonImports).where(eq(coreJsonImports.source, source));
  return done ?? null;
}

async function finish(tx: Tx, source: string, entity: string, fileCount: number, inserted: number, skipped: number) {
  await tx.insert(coreJsonImports).values({ source, fileCount, inserted, skipped });
  await writeAudit(tx, { action: 'import_json', entity, after: { source, fileCount, inserted, skipped } });
}

async function importEmployees(tx: Tx, file: string, source: string): Promise<CoreImportPart> {
  const items = await readEmployeesJson(file);
  const rows = [];
  const originals = new Map<number, unknown>();
  let skipped = 0;
  for (const item of items) {
    const row = employeeToRow(item as unknown as Record<string, unknown>, rows.length);
    if (!row || originals.has(row.id)) {
      skipped += 1;
      continue;
    }
    originals.set(row.id, item);
    rows.push(row);
  }

  let inserted = 0;
  for (const part of chunks(rows)) {
    const res = await tx.insert(employees).values(part).onConflictDoNothing().returning({ id: employees.id });
    inserted += res.length;
  }
  // История: текущее состояние «на момент импорта», с какого числа — неизвестно (valid_from = null).
  for (const part of chunks(rows)) {
    await tx
      .insert(employeeAssignmentHistory)
      .values(part.map((r) => ({ employeeId: r.id, ...assignmentOf(r), validFrom: null, source: 'import' })))
      .onConflictDoNothing();
  }

  // Сверка поле-в-поле: каждая строка из файла читается из базы ровно такой же.
  const dbRows = await tx.select().from(employees);
  const byId = new Map(dbRows.map((r) => [r.id, r]));
  let verified = 0;
  for (const [id, original] of originals) {
    const dbRow = byId.get(id);
    if (dbRow && JSON.stringify(rowToEmployee(dbRow)) === JSON.stringify(original)) verified += 1;
    else throw new Error(`импорт сотрудников: строка id=${id} в базе не совпала с файлом`);
  }
  await finish(tx, source, 'core.employees', items.length, inserted, skipped);
  return { source, status: 'imported', fileCount: items.length, inserted, skipped, verified };
}

async function importManagers(tx: Tx, file: string, source: string): Promise<CoreImportPart> {
  const a = await readManagerAssignmentsJson(file);
  const byId: { employeeId: number; managerName: string }[] = [];
  let skipped = 0;
  for (const [key, value] of Object.entries(a.byId)) {
    const id = Number(key);
    if (!/^-?\d+$/.test(key) || !Number.isSafeInteger(id) || typeof value !== 'string') {
      skipped += 1;
      continue;
    }
    byId.push({ employeeId: id, managerName: value });
  }
  const byName: { nameKey: string; managerName: string }[] = [];
  for (const [key, value] of Object.entries(a.byName)) {
    if (!key || typeof value !== 'string') {
      skipped += 1;
      continue;
    }
    byName.push({ nameKey: key, managerName: value });
  }
  const fileCount = Object.keys(a.byId).length + Object.keys(a.byName).length;

  let inserted = 0;
  for (const part of chunks(byId)) {
    inserted += (await tx.insert(managerAssignments).values(part).onConflictDoNothing().returning({ id: managerAssignments.employeeId })).length;
  }
  for (const part of chunks(byName)) {
    inserted += (await tx.insert(managerAssignmentsByName).values(part).onConflictDoNothing().returning({ k: managerAssignmentsByName.nameKey })).length;
  }

  const dbById = new Map((await tx.select().from(managerAssignments)).map((r) => [r.employeeId, r.managerName]));
  const dbByName = new Map((await tx.select().from(managerAssignmentsByName)).map((r) => [r.nameKey, r.managerName]));
  let verified = 0;
  for (const r of byId) {
    if (dbById.get(r.employeeId) !== r.managerName) throw new Error(`импорт руководителей: byId ${r.employeeId} не совпал`);
    verified += 1;
  }
  for (const r of byName) {
    if (dbByName.get(r.nameKey) !== r.managerName) throw new Error(`импорт руководителей: byName «${r.nameKey}» не совпал`);
    verified += 1;
  }
  await finish(tx, source, 'core.manager_assignments', fileCount, inserted, skipped);
  return { source, status: 'imported', fileCount, inserted, skipped, verified };
}

async function importOrg(tx: Tx, file: string, source: string): Promise<CoreImportPart> {
  const raw = await readOrgStructureJson(file);
  const rows = orgStateToRows(raw);
  const fileCount = ['executives', 'groups', 'units', 'links'].reduce(
    (n, k) => n + (Array.isArray((raw as Record<string, unknown>)[k]) ? ((raw as Record<string, unknown[]>)[k]!.length) : 0),
    0
  );
  let inserted = 0;
  if (rows.executives.length) inserted += (await tx.insert(orgExecutives).values(rows.executives).onConflictDoNothing().returning({ id: orgExecutives.id })).length;
  if (rows.groups.length) inserted += (await tx.insert(orgGroups).values(rows.groups).onConflictDoNothing().returning({ id: orgGroups.id })).length;
  for (const part of chunks(rows.units)) inserted += (await tx.insert(orgUnits).values(part).onConflictDoNothing().returning({ id: orgUnits.id })).length;
  for (const part of chunks(rows.links)) inserted += (await tx.insert(orgLinks).values(part).onConflictDoNothing().returning({ id: orgLinks.id })).length;

  const dbRows: OrgRows = {
    executives: await tx.select().from(orgExecutives),
    groups: await tx.select().from(orgGroups),
    units: await tx.select().from(orgUnits),
    links: await tx.select().from(orgLinks)
  };
  const fromFile = normalizeOrgStructureState(raw);
  const fromDb = normalizeOrgStructureState(orgRowsToState(dbRows));
  if (!isDeepStrictEqual(fromFile, fromDb)) {
    throw new Error('импорт оргструктуры: состояние из базы не совпало с файлом');
  }
  const verified = fromDb.executives.length + fromDb.groups.length + fromDb.units.length + fromDb.links.length;
  await finish(tx, source, 'core.org_structure', fileCount, inserted, rows.skipped);
  return { source, status: 'imported', fileCount, inserted, skipped: rows.skipped, verified };
}

/**
 * Разовый идемпотентный импорт employees.json / employee-managers.json / org-structure.json → схема core.
 * Одна транзакция под advisory lock записи core: либо всё, либо ничего (тогда домен остаётся на JSON).
 * Маркер в core.json_imports → повторный старт пропускает (иначе удалённое в базе воскресало бы).
 * Файлы не трогаем — остаются бэкапом.
 */
export async function importCoreFromJson(
  db: Db,
  files: CoreJsonFiles,
  sources: { employees: string; managers: string; org: string } = CORE_IMPORT_SOURCES
): Promise<CoreImportPart[]> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${CORE_WRITE_LOCK_KEY})`);
    const out: CoreImportPart[] = [];
    const steps: [string, (tx: Tx, file: string, source: string) => Promise<CoreImportPart>, string][] = [
      [sources.employees, importEmployees, files.employees],
      [sources.managers, importManagers, files.managers],
      [sources.org, importOrg, files.org]
    ];
    for (const [source, run, file] of steps) {
      const done = await marker(tx, source);
      if (done) {
        out.push({
          source,
          status: 'already',
          importedAt: done.importedAt.toISOString(),
          fileCount: done.fileCount,
          inserted: done.inserted,
          skipped: done.skipped
        });
        continue;
      }
      out.push(await run(tx, file, source));
    }
    return out;
  });
}
