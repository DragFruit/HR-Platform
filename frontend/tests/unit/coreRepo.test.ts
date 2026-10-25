import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../server/db/schema';
import { runMigrations } from '../../server/db/migrate';
import { createPgCoreRepo } from '../../server/db/repositories/core';
import { createJsonCoreRepo, type CoreJsonFiles } from '../../server/core/jsonStore';
import { importCoreFromJson } from '../../server/core/importJson';
import { employeeToRow, orgRowsToState, orgStateToRows, rowToEmployee } from '../../server/core/rowMapping';
import type { CoreRepo } from '../../server/core/types';
import { normalizeOrgStructureState, type OrgStructureState } from '../../server/utils/orgStructureStore';
import type { ServerEmployee } from '../../server/utils/employeesStore';

const anna = {
  id: 578,
  name: 'Трубицына Анна',
  title: 'Руководитель SEO/SERM',
  department: 'SEO / ORM',
  manager: 'Юдин Вадим',
  hired_at: '2016-02-24',
  platform_user_id: 578,
  bitrix_user_id: 578,
  email: 'ast@vbi.ru',
  account_role: 'manager',
  vacation_opening_balance: 135.7,
  manager_id: 12
} as ServerEmployee;

/** Ручной сотрудник: без Bitrix, явные null, пустая дата, без email — как в реальном файле. */
const manual = {
  id: 100500,
  name: 'Ручной Сотрудник',
  title: '',
  department: 'DEV',
  manager: '',
  hired_at: '',
  platform_user_id: null,
  bitrix_user_id: null,
  account_role: '',
  manager_id: null,
  legal_entity: 'ТОО «ВБИ»',
  contract_form: 'ГПХ'
} as unknown as ServerEmployee;

const org: OrgStructureState = normalizeOrgStructureState({
  executives: [{ id: 'exe-1', title: 'Финансовый директор', person: 'Сергей', order: 0, x: 72, y: 0 }],
  units: [
    {
      id: 'u-1',
      executiveId: 'exe-1',
      name: 'Бухгалтерия',
      head: '',
      order: 10,
      stackId: null,
      groupId: 'g-1',
      employees: 3,
      members: [{ name: 'Иванова' } as never],
      x: 140.25,
      y: 92,
      width: 200
    }
  ],
  groups: [{ id: 'g-1', executiveId: 'exe-1', label: 'Блок', order: 1, labelX: 5, labelY: 6 }],
  links: [
    { id: 'lnk-1', from: { kind: 'executive', id: 'exe-1', side: 'bottom' }, to: { kind: 'unit', id: 'u-1', side: 'top' }, mid: 0.5 }
  ]
});

describe('маппинг сотрудника JSON ↔ строка', () => {
  it('туда-обратно байт-в-байт: порядок ключей, null ≠ отсутствует', () => {
    for (const item of [anna, manual]) {
      const row = employeeToRow(item as unknown as Record<string, unknown>, 0)!;
      expect(JSON.stringify(rowToEmployee(row))).toBe(JSON.stringify(item));
    }
  });

  it('пустая/кривая дата и неизвестные поля — в extra, а не теряются', () => {
    const row = employeeToRow({ ...anna, hired_at: '24.02.2016', foo: { a: 1 } }, 0)!;
    expect(row.hiredAt ?? null).toBeNull();
    expect(row.extra).toEqual({ hired_at: '24.02.2016', foo: { a: 1 } });
    expect(rowToEmployee(row)).toMatchObject({ hired_at: '24.02.2016', foo: { a: 1 } });
  });

  it('без целого id строку не кладём — id не выдумываем', () => {
    expect(employeeToRow({ ...anna, id: 'x' } as never, 0)).toBeNull();
    expect(employeeToRow({ ...anna, id: 0 } as never, 0)).toBeNull();
  });
});

describe('маппинг оргструктуры', () => {
  it('после нормализации — то же состояние', () => {
    const rows = orgStateToRows(org);
    expect(rows.skipped).toBe(0);
    expect(normalizeOrgStructureState(orgRowsToState(rows))).toEqual(org);
  });
});

/** Общий контракт сырого хранилища core — одинаково для JSON и Postgres. */
function contract(name: string, makeRepo: () => Promise<CoreRepo>) {
  describe(`контракт хранилища core: ${name}`, () => {
    let repo: CoreRepo;
    beforeAll(async () => {
      repo = await makeRepo();
    });

    it('сотрудники: запись → чтение → правка → удаление', async () => {
      await repo.writeEmployeesRaw([anna, manual]);
      expect(await repo.readEmployeesRaw()).toEqual([anna, manual]);

      const moved = { ...anna, department: 'DEV', manager: 'Новый Рук', manager_id: 13 };
      await repo.writeEmployeesRaw([manual, moved]);
      expect(await repo.readEmployeesRaw()).toEqual([manual, moved]);

      await repo.writeEmployeesRaw([moved]);
      expect(await repo.readEmployeesRaw()).toEqual([moved]);
    });

    it('чтение отдаёт копию — мутация результата не портит хранилище', async () => {
      await repo.writeEmployeesRaw([anna]);
      const list = await repo.readEmployeesRaw();
      list[0]!.name = 'Испорчено';
      expect((await repo.readEmployeesRaw())[0]!.name).toBe(anna.name);
    });

    it('overlay руководителей', async () => {
      const a = { byId: { '578': 'Юдин Вадим', '100500': 'Кто-то' }, byName: { 'трубицына анна': 'Юдин Вадим' } };
      await repo.writeManagerAssignmentsRaw(a);
      expect(await repo.readManagerAssignmentsRaw()).toEqual(a);
      await repo.writeManagerAssignmentsRaw({ byId: { '578': 'Другой' }, byName: {} });
      expect(await repo.readManagerAssignmentsRaw()).toEqual({ byId: { '578': 'Другой' }, byName: {} });
    });

    it('оргструктура', async () => {
      await repo.writeOrgStructureRaw(org);
      expect(normalizeOrgStructureState(await repo.readOrgStructureRaw())).toEqual(org);
      const next = normalizeOrgStructureState({ ...org, units: [], links: [] });
      await repo.writeOrgStructureRaw(next);
      expect(normalizeOrgStructureState(await repo.readOrgStructureRaw())).toEqual(next);
    });
  });
}

let tmp = '';
const jsonFiles = (): CoreJsonFiles => ({
  employees: join(tmp, 'employees.json'),
  managers: join(tmp, 'employee-managers.json'),
  org: join(tmp, 'org-structure.json')
});
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'vbi-core-'));
});
afterAll(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

contract('JSON', async () => createJsonCoreRepo(jsonFiles()));

describe('JSON-файл пишется в прежнем формате', () => {
  it('employees.json — тот же массив', async () => {
    const repo = createJsonCoreRepo(jsonFiles());
    await repo.writeEmployeesRaw([anna]);
    expect(JSON.parse(await readFile(jsonFiles().employees, 'utf8'))).toEqual([anna]);
  });
});

/**
 * Postgres-часть: только при TEST_DATABASE_URL (локально vbi_dev). В CI базы нет — пропускается.
 * Таблицы core общие на базу, поэтому тест создаёт себе отдельную временную базу и удаляет её.
 */
const TEST_DB = String(process.env.TEST_DATABASE_URL || '').trim();
describe.skipIf(!TEST_DB)('Postgres', () => {
  const dbName = `vbi_core_test_${process.pid}_${Date.now()}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let url = '';

  beforeAll(async () => {
    admin = postgres(TEST_DB, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${dbName}"`);
    const u = new URL(TEST_DB);
    u.pathname = `/${dbName}`;
    url = u.toString();
    await runMigrations(url, join(__dirname, '../../server/db/migrations'));
    sql = postgres(url, { max: 3, onnotice: () => {} });
  });
  afterAll(async () => {
    await sql?.end({ timeout: 5 });
    await admin?.unsafe(`drop database if exists "${dbName}" with (force)`);
    await admin?.end({ timeout: 5 });
  });

  contract('Postgres', async () => createPgCoreRepo(drizzle(sql, { schema })));

  it('кэш: повторное чтение не ходит в базу, запись сразу видна', async () => {
    const repo = createPgCoreRepo(drizzle(sql, { schema }));
    await repo.writeEmployeesRaw([anna]);
    await repo.readEmployeesRaw();
    await sql`update core.employees set name = 'Правка мимо приложения' where id = ${anna.id}`;
    expect((await repo.readEmployeesRaw())[0]!.name).toBe(anna.name); // из кэша (TTL)
    await repo.writeEmployeesRaw([{ ...anna, title: 'Новая должность' }]);
    expect((await repo.readEmployeesRaw())[0]!.title).toBe('Новая должность');

    const fresh = createPgCoreRepo(drizzle(sql, { schema }), { cacheTtlMs: 0 });
    await sql`update core.employees set name = 'Правка мимо приложения' where id = ${anna.id}`;
    expect((await fresh.readEmployeesRaw())[0]!.name).toBe('Правка мимо приложения');
  });

  it('импорт: разовый, поле-в-поле, история с valid_from = null, аудит и история изменений', async () => {
    await sql`truncate core.employees, core.employee_assignment_history, core.manager_assignments,
      core.manager_assignments_by_name, core.org_executives, core.org_groups, core.org_units, core.org_links, core.json_imports, audit.audit_log`; // временная база теста
    const dir = await mkdtemp(join(tmpdir(), 'vbi-core-imp-'));
    const files: CoreJsonFiles = {
      employees: join(dir, 'employees.json'),
      managers: join(dir, 'employee-managers.json'),
      org: join(dir, 'org-structure.json')
    };
    await writeFile(files.employees, JSON.stringify([anna, manual, { ...anna, name: 'Дубль id' }, { name: 'Без id' }]));
    await writeFile(files.managers, JSON.stringify({ byId: { '578': 'Юдин Вадим', bad: 'x' }, byName: { 'трубицына анна': 'Юдин Вадим' } }));
    await writeFile(files.org, JSON.stringify({ ...org, units: [...org.units, { id: 'u-no-exec' }] }));
    const db = drizzle(sql, { schema });
    try {
      const r1 = await importCoreFromJson(db, files);
      expect(r1).toEqual([
        expect.objectContaining({ source: 'employees.json', status: 'imported', fileCount: 4, inserted: 2, skipped: 2, verified: 2 }),
        expect.objectContaining({ source: 'employee-managers.json', status: 'imported', fileCount: 3, inserted: 2, skipped: 1, verified: 2 }),
        expect.objectContaining({ source: 'org-structure.json', status: 'imported', fileCount: 5, inserted: 4, skipped: 1, verified: 4 })
      ]);

      const repo = createPgCoreRepo(db, { cacheTtlMs: 0 });
      expect(await repo.readEmployeesRaw()).toEqual([anna, manual]);
      expect(normalizeOrgStructureState(await repo.readOrgStructureRaw())).toEqual(org);

      const h0 = await sql`select employee_id, valid_from, valid_to, source from core.employee_assignment_history order by employee_id`;
      expect(h0.map((r) => [r.employee_id, r.valid_from, r.valid_to, r.source])).toEqual([
        [578, null, null, 'import'],
        [100500, null, null, 'import']
      ]);

      await repo.writeEmployeesRaw([{ ...anna, department: 'DEV' }, manual], { actorEmployeeId: 578, reason: 'test' });
      const h1 = await sql`select department, valid_from, valid_to, source from core.employee_assignment_history
        where employee_id = 578 order by id`;
      expect(h1).toHaveLength(2);
      expect(h1[0]).toMatchObject({ department: 'SEO / ORM', valid_from: null, source: 'import' });
      expect(h1[0]!.valid_to).not.toBeNull();
      expect(h1[1]).toMatchObject({ department: 'DEV', valid_to: null, source: 'write' });
      expect(h1[1]!.valid_from).not.toBeNull();

      // Перезапись без изменений не плодит ни историю, ни аудит.
      const auditBefore = await sql`select count(*)::int as n from audit.audit_log where entity = 'core.employee'`;
      await repo.writeEmployeesRaw([{ ...anna, department: 'DEV' }, manual]);
      const auditAfter = await sql`select count(*)::int as n from audit.audit_log where entity = 'core.employee'`;
      expect(auditAfter[0]!.n).toBe(auditBefore[0]!.n);

      await repo.writeEmployeesRaw([manual]);
      const audit = await sql`select action, actor_employee_id from audit.audit_log
        where entity = 'core.employee' and entity_id = '578' order by id`;
      expect(audit.map((r) => [r.action, r.actor_employee_id])).toEqual([
        ['update', 578],
        ['delete', null]
      ]);
      const open = await sql`select count(*)::int as n from core.employee_assignment_history where employee_id = 578 and valid_to is null`;
      expect(open[0]!.n).toBe(0);

      const r2 = await importCoreFromJson(db, files);
      expect(r2.map((p) => p.status)).toEqual(['already', 'already', 'already']);
      expect(await repo.readEmployeesRaw()).toEqual([manual]); // удалённое не воскресло
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
