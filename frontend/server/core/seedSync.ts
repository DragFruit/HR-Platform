import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { coreJsonImports } from '../db/schema';
import type { ServerEmployee } from '../utils/employeesStore';
import type { ManagerAssignments } from '../utils/employeeManagersStore';
import type { CoreRepo } from './types';
import type { AccessDenylistEntry } from './accessDenylistStore';
// тот же скрипт деплой запускает на файле (allowJs)
import { mergeEmployeesSeed as mergeEmployeesSeedJs } from '../../../deploy/scripts/merge-employees-seed.mjs';

/**
 * Сид сотрудников из git на стенде с DB_CORE=1. Деплой (deploy-remote.sh) по-прежнему сливает
 * сид в server/data/employees.json + employee-managers.json (merge-employees-seed.mjs), но с этапа 3
 * эти файлы только бэкап: поэтому то же слияние сервер делает в базе при старте. Один раз на
 * версию сида: маркер `employees-seed:<sha256>` в core.json_imports (удалённый/уволенный не
 * воскресает на каждом рестарте, только когда сид в git поменялся; стоп-лист сид всё равно не пропустит).
 */

export type EmployeesSeedStats = {
  merged: number;
  server: number;
  repo: number;
  both: number;
  serverOnly: number;
  repoOnly: number;
  skippedDenied: number;
};

export type EmployeesSeedResult =
  | { status: 'already'; marker: string }
  | { status: 'applied'; marker: string; employeesChanged: boolean; managersChanged: boolean; stats: EmployeesSeedStats };

export const employeesSeedMarker = (seed: unknown) =>
  `employees-seed:${createHash('sha256').update(JSON.stringify(seed)).digest('hex').slice(0, 16)}`;

export function mergeEmployeesSeed(
  target: unknown,
  incoming: unknown,
  overlay: unknown,
  denylist: unknown
): { employees: ServerEmployee[]; overlay: ManagerAssignments; stats: EmployeesSeedStats } {
  return mergeEmployeesSeedJs(target, incoming, overlay, denylist) as {
    employees: ServerEmployee[];
    overlay: ManagerAssignments;
    stats: EmployeesSeedStats;
  };
}

/**
 * Слияние сида в активный бэкенд core (Postgres). Запускается плагином db-migrate до того, как
 * core объявлен готовым, поэтому запросы API в это время ждут и не пишут параллельно.
 */
export async function applyEmployeesSeedToDb(
  db: Db,
  repo: CoreRepo,
  readDenylist: () => Promise<AccessDenylistEntry[]>,
  seed: unknown
): Promise<EmployeesSeedResult> {
  const marker = employeesSeedMarker(seed);
  const [done] = await db.select().from(coreJsonImports).where(eq(coreJsonImports.source, marker));
  if (done) return { status: 'already', marker };

  const [employees, managers, denylist] = await Promise.all([
    repo.readEmployeesRaw(),
    repo.readManagerAssignmentsRaw(),
    readDenylist()
  ]);
  const out = mergeEmployeesSeed(employees, seed, managers, denylist);
  const ctx = { reason: 'deploy-seed-merge' };
  const employeesChanged = JSON.stringify(out.employees) !== JSON.stringify(employees);
  const managersChanged = JSON.stringify(out.overlay) !== JSON.stringify(managers);
  if (employeesChanged) await repo.writeEmployeesRaw(out.employees, ctx);
  if (managersChanged) await repo.writeManagerAssignmentsRaw(out.overlay, ctx);

  await db
    .insert(coreJsonImports)
    .values({ source: marker, fileCount: Array.isArray(seed) ? seed.length : 0, inserted: out.stats.repoOnly, skipped: out.stats.skippedDenied })
    .onConflictDoNothing();
  return { status: 'applied', marker, employeesChanged, managersChanged, stats: out.stats };
}
