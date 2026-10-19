import { and, asc, getTableColumns, inArray, isNull, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Db } from '../client';
import { writeAudit, type AuditEntry } from '../audit';
import {
  employeeAssignmentHistory as hist,
  employees as emp,
  managerAssignments as mgrById,
  managerAssignmentsByName as mgrByName,
  orgExecutives,
  orgGroups,
  orgLinks,
  orgUnits
} from '../schema';
import {
  assignmentOf,
  employeeRowsEqual,
  employeeToRow,
  orgRowsToState,
  orgStateToRows,
  rowToEmployee,
  sameAssignment,
  type EmployeeRow,
  type OrgRows
} from '../../core/rowMapping';
import type { CoreRepo, CoreWriteContext } from '../../core/types';
import type { ServerEmployee } from '../../utils/employeesStore';
import type { ManagerAssignments } from '../../utils/employeeManagersStore';
import type { OrgStructureState } from '../../utils/orgStructureStore';

/** pg_advisory_xact_lock на запись домена core (несколько процессов на одной базе). */
export const CORE_WRITE_LOCK_KEY = 72_461_003;

/**
 * Сколько держим прочитанное в памяти процесса. Все записи идут через этот процесс и
 * обновляют кэш сразу; TTL — только чтобы подхватить ручную правку в базе.
 */
export const CORE_CACHE_TTL_MS = 30_000;

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** INSERT … ON CONFLICT DO UPDATE SET <все колонки, кроме ключа> = excluded.<колонка>. */
export function excludedSet(table: PgTable, skip: string[]) {
  const cols = getTableColumns(table) as Record<string, { name: string }>;
  const set: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(cols)) {
    if (skip.includes(key)) continue;
    set[key] = sql.raw(`excluded."${col.name}"`);
  }
  return set;
}

export function chunks<T>(list: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const clone = <T>(v: T): T => structuredClone(v);

type CacheSlot<T> = { value: T; at: number } | null;

export function createPgCoreRepo(db: Db, opts: { cacheTtlMs?: number } = {}): CoreRepo {
  const ttl = opts.cacheTtlMs ?? CORE_CACHE_TTL_MS;
  let version = 0;
  const cache: {
    employees: CacheSlot<ServerEmployee[]>;
    managers: CacheSlot<ManagerAssignments>;
    org: CacheSlot<Partial<OrgStructureState>>;
  } = { employees: null, managers: null, org: null };

  async function cached<K extends keyof typeof cache>(
    key: K,
    load: () => Promise<NonNullable<(typeof cache)[K]>['value']>
  ): Promise<NonNullable<(typeof cache)[K]>['value']> {
    const slot = cache[key];
    if (slot && Date.now() - slot.at < ttl) return clone(slot.value);
    const v0 = version;
    const value = await load();
    if (v0 === version) (cache as Record<string, CacheSlot<unknown>>)[key] = { value, at: Date.now() };
    return clone(value);
  }

  function store<K extends keyof typeof cache>(key: K, value: NonNullable<(typeof cache)[K]>['value']) {
    version += 1;
    (cache as Record<string, CacheSlot<unknown>>)[key] = { value: clone(value), at: Date.now() };
  }

  function drop(key: keyof typeof cache) {
    version += 1;
    cache[key] = null;
  }

  async function lock(tx: Tx) {
    await tx.execute(sql`select pg_advisory_xact_lock(${CORE_WRITE_LOCK_KEY})`);
  }

  // ---------- сотрудники ----------

  async function loadEmployees(): Promise<ServerEmployee[]> {
    const rows = await db.select().from(emp).orderBy(asc(emp.position), asc(emp.id));
    return rows.map(rowToEmployee);
  }

  async function writeEmployees(list: ServerEmployee[], ctx: CoreWriteContext = {}) {
    const next: EmployeeRow[] = [];
    const ids = new Set<number>();
    let dropped = 0;
    list.forEach((item) => {
      const row = employeeToRow(item as unknown as Record<string, unknown>, next.length);
      if (!row || ids.has(row.id)) {
        dropped += 1;
        return;
      }
      ids.add(row.id);
      next.push(row);
    });
    if (dropped) {
      console.warn(`[core] запись справочника: ${dropped} строк без целого id или с дублем id — не сохранены`);
    }

    try {
      await db.transaction(async (tx) => {
        await lock(tx);
        const prevRows = (await tx.select().from(emp)) as EmployeeRow[];
        const prevById = new Map(prevRows.map((r) => [r.id, r]));

        const upserts: EmployeeRow[] = [];
        const audits: AuditEntry[] = [];
        const opened: EmployeeRow[] = [];
        const closeIds: number[] = [];
        const base = { actorEmployeeId: ctx.actorEmployeeId ?? null };
        const reason = ctx.reason ?? null;

        for (const row of next) {
          const prev = prevById.get(row.id);
          if (!prev) {
            upserts.push(row);
            opened.push(row);
            audits.push({ ...base, action: 'create', entity: 'core.employee', entityId: String(row.id), after: { reason, ...rowToEmployee(row) } });
            continue;
          }
          if (employeeRowsEqual(prev, row)) continue;
          upserts.push(row);
          const before = rowToEmployee(prev);
          const after = rowToEmployee(row);
          if (JSON.stringify(before) !== JSON.stringify(after)) {
            audits.push({ ...base, action: 'update', entity: 'core.employee', entityId: String(row.id), before, after: { reason, ...after } });
          }
          if (!sameAssignment(assignmentOf(prev), assignmentOf(row))) {
            closeIds.push(row.id);
            opened.push(row);
          }
        }
        const removed = prevRows.filter((r) => !ids.has(r.id));
        for (const r of removed) {
          closeIds.push(r.id);
          audits.push({ ...base, action: 'delete', entity: 'core.employee', entityId: String(r.id), before: rowToEmployee(r), after: reason ? { reason } : null });
        }

        if (removed.length) {
          for (const part of chunks(removed.map((r) => r.id), 1000)) {
            await tx.delete(emp).where(inArray(emp.id, part));
          }
        }
        for (const part of chunks(upserts)) {
          await tx
            .insert(emp)
            .values(part.map((r) => ({ ...r, updatedAt: new Date() })))
            .onConflictDoUpdate({ target: emp.id, set: excludedSet(emp, ['id', 'createdAt']) });
        }
        if (closeIds.length) {
          for (const part of chunks(closeIds, 1000)) {
            await tx
              .update(hist)
              .set({ validTo: sql`now()` })
              .where(and(inArray(hist.employeeId, part), isNull(hist.validTo)));
          }
        }
        if (opened.length) {
          const newIds = new Set(next.filter((r) => !prevById.has(r.id)).map((r) => r.id));
          for (const part of chunks(opened)) {
            await tx.insert(hist).values(
              part.map((r) => ({
                employeeId: r.id,
                ...assignmentOf(r),
                validFrom: sql`now()`,
                source: newIds.has(r.id) ? 'added' : 'write'
              }))
            );
          }
        }
        if (audits.length) {
          for (const part of chunks(audits, 200)) await writeAudit(tx, part);
        }
      });
    } catch (err) {
      drop('employees');
      throw err;
    }
    store('employees', next.map(rowToEmployee));
  }

  // ---------- overlay руководителей ----------

  async function loadManagers(): Promise<ManagerAssignments> {
    const [byIdRows, byNameRows] = await Promise.all([
      db.select().from(mgrById).orderBy(asc(mgrById.employeeId)),
      db.select().from(mgrByName).orderBy(asc(mgrByName.nameKey))
    ]);
    const out: ManagerAssignments = { byId: {}, byName: {} };
    byIdRows.forEach((r) => (out.byId[String(r.employeeId)] = r.managerName));
    byNameRows.forEach((r) => (out.byName[r.nameKey] = r.managerName));
    return out;
  }

  async function writeManagers(assignments: ManagerAssignments, ctx: CoreWriteContext = {}) {
    const nextById = new Map<number, string>();
    for (const [key, value] of Object.entries(assignments.byId || {})) {
      const id = Number(key);
      if (!/^-?\d+$/.test(key) || !Number.isSafeInteger(id)) {
        console.warn(`[core] overlay руководителей: ключ byId «${key}» — не id сотрудника, пропущен`);
        continue;
      }
      nextById.set(id, String(value));
    }
    const nextByName = new Map(Object.entries(assignments.byName || {}).map(([k, v]) => [k, String(v)]));

    try {
      await db.transaction(async (tx) => {
        await lock(tx);
        const [prevById, prevByName] = await Promise.all([tx.select().from(mgrById), tx.select().from(mgrByName)]);
        const base = { actorEmployeeId: ctx.actorEmployeeId ?? null };
        const audits: AuditEntry[] = [];

        const prevIdMap = new Map(prevById.map((r) => [r.employeeId, r.managerName]));
        const idUpserts = [...nextById].filter(([id, m]) => prevIdMap.get(id) !== m);
        const idDeletes = [...prevIdMap.keys()].filter((id) => !nextById.has(id));
        for (const [id, m] of idUpserts) {
          audits.push({ ...base, action: prevIdMap.has(id) ? 'update' : 'create', entity: 'core.manager_assignment', entityId: String(id), before: prevIdMap.has(id) ? { manager: prevIdMap.get(id) } : null, after: { manager: m, reason: ctx.reason ?? null } });
        }
        for (const id of idDeletes) {
          audits.push({ ...base, action: 'delete', entity: 'core.manager_assignment', entityId: String(id), before: { manager: prevIdMap.get(id) }, after: ctx.reason ? { reason: ctx.reason } : null });
        }

        const prevNameMap = new Map(prevByName.map((r) => [r.nameKey, r.managerName]));
        const nameUpserts = [...nextByName].filter(([k, m]) => prevNameMap.get(k) !== m);
        const nameDeletes = [...prevNameMap.keys()].filter((k) => !nextByName.has(k));
        if (nameUpserts.length || nameDeletes.length) {
          audits.push({ ...base, action: 'update', entity: 'core.manager_assignment_by_name', after: { upserted: nameUpserts.map(([k]) => k), deleted: nameDeletes, reason: ctx.reason ?? null } });
        }

        for (const part of chunks(idDeletes, 1000)) await tx.delete(mgrById).where(inArray(mgrById.employeeId, part));
        for (const part of chunks(idUpserts)) {
          await tx
            .insert(mgrById)
            .values(part.map(([employeeId, managerName]) => ({ employeeId, managerName, updatedAt: new Date() })))
            .onConflictDoUpdate({ target: mgrById.employeeId, set: excludedSet(mgrById, ['employeeId']) });
        }
        for (const part of chunks(nameDeletes, 1000)) await tx.delete(mgrByName).where(inArray(mgrByName.nameKey, part));
        for (const part of chunks(nameUpserts)) {
          await tx
            .insert(mgrByName)
            .values(part.map(([nameKey, managerName]) => ({ nameKey, managerName, updatedAt: new Date() })))
            .onConflictDoUpdate({ target: mgrByName.nameKey, set: excludedSet(mgrByName, ['nameKey']) });
        }
        if (audits.length) for (const part of chunks(audits, 200)) await writeAudit(tx, part);
      });
    } catch (err) {
      drop('managers');
      throw err;
    }
    drop('managers'); // перечитаем из базы (порядок ключей, пропущенные невалидные)
  }

  // ---------- оргструктура ----------

  async function loadOrgRows(q: Pick<Db, 'select'>): Promise<OrgRows> {
    const [executives, groups, units, links] = await Promise.all([
      q.select().from(orgExecutives),
      q.select().from(orgGroups),
      q.select().from(orgUnits),
      q.select().from(orgLinks)
    ]);
    return { executives, groups, units, links } as OrgRows;
  }

  async function writeOrg(state: OrgStructureState, ctx: CoreWriteContext = {}) {
    const rows = orgStateToRows(state);
    try {
      await db.transaction(async (tx) => {
        await lock(tx);
        const prev = await loadOrgRows(tx);
        const diff: Record<string, { added: string[]; removed: string[]; changed: string[] }> = {};
        for (const kind of ['executives', 'groups', 'units', 'links'] as const) {
          const before = new Map((prev[kind] as { id: string }[]).map((r) => [r.id, JSON.stringify(r)]));
          const after = new Map((rows[kind] as { id: string }[]).map((r) => [r.id, r]));
          const d = { added: [] as string[], removed: [] as string[], changed: [] as string[] };
          for (const [id, r] of after) {
            if (!before.has(id)) d.added.push(id);
            else if (before.get(id) !== JSON.stringify({ ...JSON.parse(before.get(id)!), ...r })) d.changed.push(id);
          }
          for (const id of before.keys()) if (!after.has(id)) d.removed.push(id);
          if (d.added.length || d.removed.length || d.changed.length) diff[kind] = d;
        }
        if (!Object.keys(diff).length) return;

        await tx.delete(orgLinks);
        await tx.delete(orgUnits);
        await tx.delete(orgGroups);
        await tx.delete(orgExecutives);
        if (rows.executives.length) await tx.insert(orgExecutives).values(rows.executives);
        if (rows.groups.length) await tx.insert(orgGroups).values(rows.groups);
        for (const part of chunks(rows.units)) await tx.insert(orgUnits).values(part);
        for (const part of chunks(rows.links)) await tx.insert(orgLinks).values(part);
        await writeAudit(tx, {
          action: 'update',
          entity: 'core.org_structure',
          actorEmployeeId: ctx.actorEmployeeId ?? null,
          after: { reason: ctx.reason ?? null, ...diff }
        });
      });
    } catch (err) {
      drop('org');
      throw err;
    }
    store('org', orgRowsToState(rows));
  }

  return {
    backend: 'postgres',
    readEmployeesRaw: () => cached('employees', loadEmployees),
    writeEmployeesRaw: writeEmployees,
    readManagerAssignmentsRaw: () => cached('managers', loadManagers),
    writeManagerAssignmentsRaw: writeManagers,
    readOrgStructureRaw: () => cached('org', async () => orgRowsToState(await loadOrgRows(db))),
    writeOrgStructureRaw: writeOrg
  };
}
