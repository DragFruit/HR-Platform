import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../server/db/schema';
import { runMigrations } from '../../server/db/migrate';
import { createPgVacationsRepo } from '../../server/db/repositories/vacations';
import { createJsonVacationsRepo } from '../../server/vacations/jsonStore';
import { importVacationsFromJson } from '../../server/vacations/importJson';
import { requestToRow, rowToRequest, rowsToState, stateToRows } from '../../server/vacations/rowMapping';
import type { PersistedVacationState, VacationsRepo } from '../../server/vacations/types';
import { normalizeVacationStoreState, type VacationRequest } from '../../server/utils/vacationsStore';

/** Согласованная заявка с полным набором полей синка Bitrix — как на стейдже. */
const synced = {
  id: 1043,
  employee: 'Трубицына Анна',
  employee_id: 578,
  start: '2026-10-12',
  end: '2026-10-25',
  status: 'approved',
  comment: 'Заявка из платформы',
  createdAt: '01.09.2026',
  bitrix_absence_id: 32004,
  bitrix_absence_iblock_id: 3,
  bitrix_sync_status: 'synced',
  bitrix_sync_method: 'lists.element.add',
  bitrix_synced_at: '2026-10-16T08:24:11.123Z'
} as VacationRequest;

/** Ошибка синка, employee_id = null (а не отсутствует), шаг согласования. */
const failed = {
  id: 1200,
  employee: 'Ручной Сотрудник',
  employee_id: null,
  start: '2027-01-10',
  end: '2027-01-20',
  status: 'pending',
  approval_step: 'director',
  comment: '',
  createdAt: '19.10.2026',
  bitrix_sync_status: 'failed',
  bitrix_sync_error: 'staging: запись в Bitrix отключена',
  bitrix_synced_at: '2026-10-19T09:00:00.000Z'
} as unknown as VacationRequest;

/** Старая заявка без employee_id и с порядком ключей как в файле 2025 года. */
const legacy = {
  id: 3,
  employee: 'Юдин Вадим',
  start: '2025-07-01',
  end: '2025-07-14',
  status: 'approved',
  approval_step: 'director',
  comment: 'импорт xlsx',
  createdAt: '01.07.2025'
} as VacationRequest;

const reservation = {
  id: 5,
  employee: 'Трубицына Анна',
  employee_id: 578,
  year: 2026,
  month: 12,
  durationDays: 7,
  comment: '',
  createdAt: '10.10.2026'
};

const baseState = (): PersistedVacationState => ({
  primaryYear: 2026,
  requestsByYear: { '2025': [legacy], '2026': [synced], '2027': [failed] },
  nextRequestId: 1201,
  reservationsByYear: { '2026': [reservation as never], '2027': [] },
  nextReservationId: 6,
  qaDemoSuppressed: { requestIds: [9106], reservationIds: [] }
});

const s = (v: unknown) => JSON.stringify(v);

describe('маппинг отпусков JSON ↔ строки', () => {
  it('заявка туда-обратно байт-в-байт: порядок ключей, null ≠ отсутствует, поля Bitrix', () => {
    for (const item of [synced, failed, legacy]) {
      const row = requestToRow(item, '2026', 0)!;
      expect(s(rowToRequest(row))).toBe(s(item));
    }
    const row = requestToRow(synced, '2026', 0)!;
    expect(row).toMatchObject({
      bitrixAbsenceId: 32004,
      bitrixAbsenceIblockId: 3,
      bitrixSyncStatus: 'synced',
      bitrixSyncMethod: 'lists.element.add',
      bitrixSyncedAt: '2026-10-16T08:24:11.123Z',
      startDate: '2026-10-12',
      endDate: '2026-10-25'
    });
  });

  it('undefined-поля после снятия синка пропадают, как в JSON.stringify', () => {
    const item = { ...synced, bitrix_absence_id: undefined, bitrix_sync_status: undefined } as unknown as VacationRequest;
    expect(s(rowToRequest(requestToRow(item, '2026', 0)!))).toBe(s(item));
  });

  it('кривая дата и неизвестные поля — в extra, а не теряются', () => {
    const item = { ...legacy, start: '01.07.2025', foo: { b: 1, a: 2 } } as unknown as VacationRequest;
    const row = requestToRow(item, '2025', 0)!;
    expect(row.startDate ?? null).toBeNull();
    expect(row.extra).toEqual({ start: '01.07.2025', foo: { b: 1, a: 2 } });
    expect(s(rowToRequest(row))).toBe(s(item));
  });

  it('состояние целиком: пустые папки годов, счётчики, qaDemoSuppressed', () => {
    const st = baseState();
    const rows = stateToRows(st);
    expect(rows.skipped).toEqual([]);
    expect(s(rowsToState(rows.state, rows.requests, rows.reservations))).toBe(s(st));
  });

  it('без целого id и дубли id не кладём', () => {
    const rows = stateToRows({ requestsByYear: { '2026': [synced, { ...synced }, { employee: 'x' } as never] } });
    expect(rows.requests).toHaveLength(1);
    expect(rows.skipped).toHaveLength(2);
  });
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Общий контракт сырого хранилища отпусков — одинаково для JSON и Postgres. */
function contract(name: string, makeRepo: () => Promise<VacationsRepo>) {
  describe(`контракт хранилища отпусков: ${name}`, () => {
    let repo: VacationsRepo;
    beforeAll(async () => {
      repo = await makeRepo();
    });

    it('запись → чтение байт-в-байт', async () => {
      await repo.writeRaw(baseState());
      expect(s(await repo.readRaw())).toBe(s(baseState()));
    });

    it('мутация: создание, перенос между годами, удаление, снятие полей Bitrix', async () => {
      await repo.writeRaw(baseState());
      await repo.mutateRaw(async (st) => {
        const id = st.nextRequestId!;
        st.nextRequestId = id + 1;
        st.requestsByYear!['2026'] = [...st.requestsByYear!['2026']!, { ...legacy, id, start: '2026-03-01', end: '2026-03-05' }];
        // перенос 1043 в 2027
        const item = st.requestsByYear!['2026']!.find((r) => r.id === 1043)!;
        st.requestsByYear!['2026'] = st.requestsByYear!['2026']!.filter((r) => r.id !== 1043);
        item.start = '2027-02-01';
        item.end = '2027-02-10';
        item.status = 'pending';
        delete item.bitrix_absence_id;
        item.bitrix_sync_status = undefined;
        st.requestsByYear!['2027'] = [...st.requestsByYear!['2027']!, item];
        st.requestsByYear!['2025'] = [];
        return st;
      });
      const got = await repo.readRaw();
      const expected = baseState();
      expected.nextRequestId = 1202;
      expected.requestsByYear = {
        '2025': [],
        '2026': [{ ...legacy, id: 1201, start: '2026-03-01', end: '2026-03-05' }],
        '2027': [
          failed,
          JSON.parse(s({ ...synced, start: '2027-02-01', end: '2027-02-10', status: 'pending', bitrix_absence_id: undefined, bitrix_sync_status: undefined }))
        ]
      };
      expect(s(got)).toBe(s(expected));
    });

    it('ошибка в мутации — ничего не записано', async () => {
      await repo.writeRaw(baseState());
      await expect(
        repo.mutateRaw(async (st) => {
          st.nextRequestId = 99999;
          st.requestsByYear = {};
          throw new Error('нельзя');
        })
      ).rejects.toThrow('нельзя');
      expect(s(await repo.readRaw())).toBe(s(baseState()));
    });

    it('параллельные мутации идут строго по очереди: ни одна правка не теряется, id не дублируются', async () => {
      await repo.writeRaw(baseState());
      const created: number[] = [];
      await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          repo.mutateRaw(async (st) => {
            const id = st.nextRequestId!;
            await sleep(i % 3); // как сетевой вызов Bitrix внутри mutateVacations
            st.nextRequestId = id + 1;
            st.requestsByYear!['2026']!.push({ ...legacy, id, start: '2026-05-01', end: '2026-05-02' });
            created.push(id);
            return st;
          })
        )
      );
      const got = await repo.readRaw();
      expect(got.nextRequestId).toBe(1201 + 12);
      const ids = got.requestsByYear!['2026']!.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.slice(1)).toEqual(created);
      expect(created).toEqual(Array.from({ length: 12 }, (_, i) => 1201 + i));
    });

    it('поля синка Bitrix переживают запись и чтение', async () => {
      await repo.writeRaw(baseState());
      await repo.mutateRaw(async (st) => {
        const item = st.requestsByYear!['2027']!.find((r) => r.id === 1200)!;
        item.status = 'approved';
        delete (item as Partial<VacationRequest>).approval_step;
        item.bitrix_absence_id = 33212;
        item.bitrix_absence_iblock_id = 3;
        item.bitrix_sync_status = 'synced';
        item.bitrix_sync_method = 'lists.element.update';
        item.bitrix_synced_at = '2026-10-19T10:00:00.000Z';
        item.bitrix_sync_error = undefined;
        return st;
      });
      const item = (await repo.readRaw()).requestsByYear!['2027']!.find((r) => r.id === 1200)!;
      expect(s(item)).toBe(
        s({
          id: 1200,
          employee: 'Ручной Сотрудник',
          employee_id: null,
          start: '2027-01-10',
          end: '2027-01-20',
          status: 'approved',
          comment: '',
          createdAt: '19.10.2026',
          bitrix_sync_status: 'synced',
          bitrix_synced_at: '2026-10-19T10:00:00.000Z',
          bitrix_absence_id: 33212,
          bitrix_absence_iblock_id: 3,
          bitrix_sync_method: 'lists.element.update'
        })
      );
    });
  });
}

let tmp = '';
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'vbi-vac-'));
});
afterAll(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

contract('JSON', async () => createJsonVacationsRepo(join(tmp, 'vacations.json')));

describe('JSON-файл пишется в прежнем формате', () => {
  it('vacations.json — тот же объект', async () => {
    const file = join(tmp, 'format.json');
    await createJsonVacationsRepo(file).writeRaw(baseState());
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(baseState());
  });
});

/**
 * Postgres-часть: только при TEST_DATABASE_URL (локально vbi_dev). В CI базы нет — пропускается.
 * Тест создаёт себе отдельную временную базу и удаляет её.
 */
const TEST_DB = String(process.env.TEST_DATABASE_URL || '').trim();
describe.skipIf(!TEST_DB)('Postgres', () => {
  const dbName = `vbi_vac_test_${process.pid}_${Date.now()}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let sql2: postgres.Sql;
  let url = '';

  beforeAll(async () => {
    admin = postgres(TEST_DB, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${dbName}"`);
    const u = new URL(TEST_DB);
    u.pathname = `/${dbName}`;
    url = u.toString();
    await runMigrations(url, join(__dirname, '../../server/db/migrations'));
    sql = postgres(url, { max: 3, onnotice: () => {} });
    sql2 = postgres(url, { max: 3, onnotice: () => {} });
  });
  afterAll(async () => {
    await sql?.end({ timeout: 5 });
    await sql2?.end({ timeout: 5 });
    await admin?.unsafe(`drop database if exists "${dbName}" with (force)`);
    await admin?.end({ timeout: 5 });
  });

  const reset = () =>
    sql`truncate vacations.requests, vacations.reservations, vacations.state, vacations.request_status_history,
      vacations.json_imports, audit.audit_log`; // временная база теста

  contract('Postgres', async () => createPgVacationsRepo(drizzle(sql, { schema })));

  it('два процесса на одной базе: advisory lock сериализует мутации', async () => {
    await reset();
    const a = createPgVacationsRepo(drizzle(sql, { schema }));
    const b = createPgVacationsRepo(drizzle(sql2, { schema }));
    await a.writeRaw(baseState());
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        (i % 2 ? a : b).mutateRaw(async (st) => {
          const id = st.nextRequestId!;
          await sleep(3);
          st.nextRequestId = id + 1;
          st.requestsByYear!['2026']!.push({ ...legacy, id, start: '2026-06-01', end: '2026-06-02' });
          return st;
        })
      )
    );
    const got = await a.readRaw();
    expect(got.nextRequestId).toBe(1211);
    const ids = got.requestsByYear!['2026']!.map((r) => r.id).slice(1).sort((x, y) => x - y);
    expect(ids).toEqual(Array.from({ length: 10 }, (_, i) => 1201 + i));
  });

  it('история статусов и аудит пишутся с момента переезда, без выдуманного прошлого', async () => {
    await reset();
    const repo = createPgVacationsRepo(drizzle(sql, { schema }));
    await repo.writeRaw(baseState(), { reason: 'seed' });
    await sql`truncate vacations.request_status_history, audit.audit_log`;

    await repo.mutateRaw(async (st) => {
      const item = st.requestsByYear!['2027']!.find((r) => r.id === 1200)!;
      item.status = 'approved';
      delete (item as Partial<VacationRequest>).approval_step;
      return st;
    }, { actorEmployeeId: 12, reason: 'api:request-patch' });
    // Перезапись без изменений ничего не пишет.
    await repo.mutateRaw(async (st) => st, { actorEmployeeId: 12, reason: 'noop' });
    await repo.mutateRaw(async (st) => {
      st.requestsByYear!['2026'] = [];
      return st;
    }, { actorEmployeeId: 1, reason: 'api:request-delete' });

    const h = await sql`select request_id, kind, actor_employee_id, reason, status_before, status_after,
      approval_step_before, approval_step_after from vacations.request_status_history order by id`;
    expect(h.map((r) => ({ ...r }))).toEqual([
      { request_id: 1200, kind: 'update', actor_employee_id: 12, reason: 'api:request-patch', status_before: 'pending', status_after: 'approved', approval_step_before: 'director', approval_step_after: null },
      { request_id: 1043, kind: 'delete', actor_employee_id: 1, reason: 'api:request-delete', status_before: 'approved', status_after: null, approval_step_before: null, approval_step_after: null }
    ]);
    const audit = await sql`select action, entity, entity_id, actor_employee_id from audit.audit_log order by id`;
    expect(audit.map((r) => [r.action, r.entity, r.entity_id, r.actor_employee_id])).toEqual([
      ['update', 'vacations.request', '1200', 12],
      ['delete', 'vacations.request', '1043', 1]
    ]);
  });

  it('импорт: разовый, поле-в-поле, удалённое не воскресает', async () => {
    await reset();
    const file = join(tmp, 'import.json');
    await writeFile(file, s(baseState()));
    const db = drizzle(sql, { schema });
    const r1 = await importVacationsFromJson(db, file);
    expect(r1).toEqual({ status: 'imported', fileCount: 4, requests: 3, reservations: 1, inserted: 4, skipped: 0, verified: 4 });

    const repo = createPgVacationsRepo(db);
    expect(s(await repo.readRaw())).toBe(s(baseState()));
    const audit = await sql`select action, entity from audit.audit_log`;
    expect(audit.map((r) => [r.action, r.entity])).toEqual([['import_json', 'vacations']]);

    await repo.mutateRaw(async (st) => {
      st.requestsByYear!['2025'] = [];
      return st;
    });
    const r2 = await importVacationsFromJson(db, file);
    expect(r2.status).toBe('already');
    expect((await repo.readRaw()).requestsByYear!['2025']).toEqual([]);
  });

  it('импорт реального vacations.json: API-ответ из базы байт-в-байт как из файла', async () => {
    await reset();
    const file = join(tmp, 'real.json');
    await copyFile(join(__dirname, '../../server/data/vacations.json'), file);
    const db = drizzle(sql, { schema });
    const r = await importVacationsFromJson(db, file);
    expect(r.status).toBe('imported');
    if (r.status !== 'imported') return;
    expect(r.skipped).toBe(0);
    expect(r.verified).toBe(r.fileCount);

    const fromJson = normalizeVacationStoreState(await createJsonVacationsRepo(file).readRaw());
    const fromDb = normalizeVacationStoreState(await createPgVacationsRepo(db).readRaw());
    expect(s(fromDb)).toBe(s(fromJson));
  });
});
