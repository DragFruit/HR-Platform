import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../server/db/schema';
import { runMigrations } from '../../server/db/migrate';
import { createPgAdminNotificationsRepo } from '../../server/db/repositories/adminNotifications';
import { createJsonAdminNotificationsRepo } from '../../server/adminNotifications/jsonStore';
import { importAdminNotificationsFromJson } from '../../server/adminNotifications/importJson';
import { adminNotificationToRow, rowToAdminNotification } from '../../server/adminNotifications/rowMapping';
import type { AdminNotification, AdminNotificationsRepo } from '../../server/adminNotifications/types';
import {
  createJsonReminderLogRepo,
  createPgReminderLogRepo,
  importReminderLogFromJson,
  REMINDER_LOGS,
  reminderToRow,
  rowToReminder,
  type ReminderLogRecord,
  type ReminderLogRepo
} from '../../server/vacations/reminderLogs';
import {
  createJsonAccessDenylistRepo,
  denylistEntryToRow,
  rowToDenylistEntry,
  type AccessDenylistEntry,
  type AccessDenylistRepo
} from '../../server/core/accessDenylistStore';
import { createPgAccessDenylistRepo } from '../../server/db/repositories/accessDenylist';
import { importAccessDenylistFromJson } from '../../server/core/importDenylist';

const fieldSync = {
  id: '0b6f1e2a-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  kind: 'bitrix_employee_title',
  employee_id: 578,
  bitrix_user_id: 578,
  employee_name: 'Трубицына Анна',
  field: 'title',
  platform_value: 'Руководитель SEO',
  bitrix_value: 'Руководитель SEO/SERM',
  created_at: '2026-06-30T10:32:30.065Z',
  admin_seen: false
} as AdminNotification;

const vacationFailed = {
  id: '1b6f1e2a-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  kind: 'bitrix_vacation_sync_failed',
  employee_id: 12,
  employee_name: 'Юдин Вадим',
  vacation_request_id: 41,
  vacation_start: '2026-07-01',
  vacation_end: '2026-07-14',
  error_message: 'timeout',
  created_at: '2026-07-01T08:00:00.000Z',
  admin_seen: true
} as AdminNotification;

const feedback = {
  id: '2b6f1e2a-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  kind: 'page_feedback',
  employee_id: 100500,
  employee_name: 'Ручной Сотрудник',
  stars: 5,
  comment: '',
  page: '/knowledge',
  photo_id: 'p1',
  photo_ids: ['p1', 'p2'],
  created_at: '2026-07-02T08:00:00.000Z',
  admin_seen: false
} as AdminNotification;

describe('маппинг уведомления админки JSON ↔ строка', () => {
  it('туда-обратно байт-в-байт: порядок ключей, массивы, разные виды', () => {
    for (const item of [fieldSync, vacationFailed, feedback]) {
      const row = adminNotificationToRow(item as never, 0)!;
      expect(JSON.stringify(rowToAdminNotification(row))).toBe(JSON.stringify(item));
    }
  });

  it('значение не своего типа и неизвестные поля — в extra; undefined не хранится', () => {
    const odd = { ...fieldSync, stars: 4.5, created_at: '30.06.2026', foo: { a: 1 }, vpn_panel: undefined };
    const row = adminNotificationToRow(odd as never, 0)!;
    expect(row.stars ?? null).toBeNull();
    expect(row.createdAt ?? null).toBeNull();
    expect(row.extra).toEqual({ stars: 4.5, created_at: '30.06.2026', foo: { a: 1 } });
    expect(row.sourceKeys).not.toContain('vpn_panel');
    expect(JSON.stringify(rowToAdminNotification(row))).toBe(JSON.stringify(JSON.parse(JSON.stringify(odd))));
  });

  it('без id или kind строку не кладём', () => {
    expect(adminNotificationToRow({ ...fieldSync, id: '' } as never, 0)).toBeNull();
    expect(adminNotificationToRow({ ...fieldSync, kind: undefined } as never, 0)).toBeNull();
  });
});

describe('маппинг журналов напоминаний и стоп-листа', () => {
  it('напоминание: message_id числом и строкой', () => {
    const def = REMINDER_LOGS.pre;
    for (const message_id of [123, 'abc', undefined]) {
      const item = JSON.parse(JSON.stringify({ key: 'pre_3w:41:2026-07-01', kind: 'pre_3w', request_id: 41, employee: 'Юдин Вадим', bitrix_user_id: 12, start: '2026-07-01', end: '2026-07-14', sent_at: '2026-06-10T06:00:00.000Z', channel: 'im.notify', message_id }));
      const row = reminderToRow(def, item, 0)!;
      expect(JSON.stringify(rowToReminder(def, row as never))).toBe(JSON.stringify(item));
    }
  });

  it('стоп-лист: null ≠ отсутствует, время ISO', () => {
    const e = { bitrix_user_id: null, platform_user_id: null, name: 'Ушёл', employee_id: 7, revoked_at: '2026-10-01T10:00:00.000Z', reason: 'removed-from-roster', avatar_purged: false };
    const row = denylistEntryToRow(e, 0)!;
    expect(JSON.stringify(rowToDenylistEntry(row))).toBe(JSON.stringify(e));
    expect(denylistEntryToRow('строка', 0)).toBeNull();
  });
});

function adminContract(name: string, makeRepo: () => Promise<AdminNotificationsRepo>) {
  describe(`контракт уведомлений админки: ${name}`, () => {
    let repo: AdminNotificationsRepo;
    beforeAll(async () => {
      repo = await makeRepo();
    });

    it('создание, чтение в порядке файла, счётчик, поиск по id', async () => {
      await repo.mutate((items) => {
        items.splice(0, items.length);
        items.push(fieldSync, vacationFailed);
      });
      expect(await repo.readAll()).toEqual([fieldSync, vacationFailed]);
      expect(await repo.countUnseen()).toBe(1);
      expect(await repo.getById(vacationFailed.id)).toEqual(vacationFailed);
      expect(await repo.getById('нет')).toBeNull();
    });

    it('правка на месте, удаление из середины, новые в конец; результат fn возвращается', async () => {
      const res = await repo.mutate((items) => {
        items.splice(0, 1);
        const v = items.find((i) => i.id === vacationFailed.id)!;
        v.error_message = 'снова timeout';
        items.push({ ...feedback, photo_ids: undefined } as AdminNotification);
        return 'ok';
      });
      expect(res).toBe('ok');
      const { photo_ids: _drop, ...feedbackNoPhotos } = feedback;
      expect(await repo.readAll()).toEqual([{ ...vacationFailed, error_message: 'снова timeout' }, feedbackNoPhotos]);
      expect(await repo.countUnseen()).toBe(1);
    });

    it('отметить прочитанным; ошибка в fn ничего не пишет', async () => {
      await repo.mutate((items) => items.forEach((i) => (i.admin_seen = true)));
      expect(await repo.countUnseen()).toBe(0);
      await expect(
        repo.mutate((items) => {
          items.push(fieldSync);
          throw new Error('стоп');
        })
      ).rejects.toThrow('стоп');
      expect((await repo.readAll()).map((i) => i.id)).toEqual([vacationFailed.id, feedback.id]);
    });
  });
}

const preRow = (key: string, message_id?: number | string) =>
  JSON.parse(JSON.stringify({ key, kind: 'pre_3w', request_id: 41, employee: 'Юдин Вадим', bitrix_user_id: 12, start: '2026-07-01', end: '2026-07-14', sent_at: '2026-06-10T06:00:00.000Z', channel: 'im.notify', message_id })) as ReminderLogRecord;

function reminderContract(name: string, makeRepo: () => Promise<ReminderLogRepo<ReminderLogRecord>>) {
  describe(`контракт журнала напоминаний: ${name}`, () => {
    it('has / record идемпотентно / порядок', async () => {
      const repo = await makeRepo();
      expect(await repo.has('pre_3w:41:2026-07-01')).toBe(false);
      await repo.record(preRow('pre_3w:41:2026-07-01', 5));
      await repo.record(preRow('pre_3w:41:2026-07-01', 6)); // дубль ключа — не пишется
      await repo.record(preRow('pre_3w:42:2026-08-01', 'x'));
      expect(await repo.has('pre_3w:41:2026-07-01')).toBe(true);
      expect(await repo.readAll()).toEqual([preRow('pre_3w:41:2026-07-01', 5), preRow('pre_3w:42:2026-08-01', 'x')]);
    });
  });
}

const revoked = (id: number, extra: Partial<AccessDenylistEntry> = {}): AccessDenylistEntry => ({
  bitrix_user_id: id,
  platform_user_id: id,
  email: `u${id}@vbi.ru`,
  name: `Сотрудник ${id}`,
  employee_id: id,
  revoked_at: '2026-10-01T10:00:00.000Z',
  reason: 'removed-from-roster',
  avatar_purge_at: '2026-10-15T10:00:00.000Z',
  vacations_purge_at: '2027-10-01T10:00:00.000Z',
  wallet_purge_at: '2027-10-01T10:00:00.000Z',
  purchases_purge_at: '2027-10-01T10:00:00.000Z',
  avatar_purged: false,
  vacations_purged: false,
  ...extra
});

function denylistContract(name: string, makeRepo: () => Promise<AccessDenylistRepo>) {
  describe(`контракт стоп-листа: ${name}`, () => {
    it('чтение / правка / null = без изменений / копия', async () => {
      const repo = await makeRepo();
      await repo.mutate(() => [revoked(1), { ...revoked(2), email: undefined, bitrix_user_id: null }]);
      expect(await repo.read()).toEqual([revoked(1), JSON.parse(JSON.stringify({ ...revoked(2), email: undefined, bitrix_user_id: null }))]);
      await repo.mutate(() => null);
      expect(await repo.read()).toHaveLength(2);
      const list = await repo.read();
      list[0]!.name = 'Испорчено';
      expect((await repo.read())[0]!.name).toBe('Сотрудник 1');
      await repo.mutate((entries) => entries.filter((e) => e.employee_id !== 1));
      expect((await repo.read()).map((e) => e.employee_id)).toEqual([2]);
    });
  });
}

let tmp = '';
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'vbi-stage5-'));
});
afterAll(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

adminContract('JSON', async () => createJsonAdminNotificationsRepo(join(tmp, 'admin-notifications.json')));
reminderContract('JSON', async () => createJsonReminderLogRepo(() => join(tmp, 'vacation-pre-reminders.json')));
denylistContract('JSON', async () => createJsonAccessDenylistRepo(join(tmp, 'employee-access-denylist.json')));

describe('JSON-файлы пишутся в прежнем формате', () => {
  it('admin-notifications.json — { items }', async () => {
    const file = join(tmp, 'fmt-admin.json');
    await createJsonAdminNotificationsRepo(file).mutate((items) => items.push(fieldSync));
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ items: [fieldSync] });
  });
  it('журнал — { version: 1, sent }', async () => {
    const file = join(tmp, 'fmt-pre.json');
    await createJsonReminderLogRepo(() => file).record(preRow('k1'));
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ version: 1, sent: [preRow('k1')] });
  });
});

describe('стоп-лист: база недоступна', () => {
  it('без кэша — проверка по JSON-зеркалу (не пустой список и не ошибка)', async () => {
    const mirror = join(tmp, 'mirror-denylist.json');
    await writeFile(mirror, JSON.stringify({ entries: [revoked(9)] }));
    const dead = postgres('postgres://127.0.0.1:1/none', { max: 1, connect_timeout: 1, onnotice: () => {} });
    try {
      const repo = createPgAccessDenylistRepo(drizzle(dead, { schema }), { mirrorFile: mirror, cacheTtlMs: 0 });
      expect(await repo.read()).toEqual([revoked(9)]);
      await expect(repo.mutate(() => [])).rejects.toBeTruthy(); // запись без базы — ошибка, а не тихий успех
      expect(JSON.parse(await readFile(mirror, 'utf8'))).toEqual({ entries: [revoked(9)] });
    } finally {
      await dead.end({ timeout: 1 });
    }
  });
});

/**
 * Postgres-часть: только при TEST_DATABASE_URL (локально vbi_dev). В CI базы нет — пропускается.
 * Тест создаёт себе отдельную временную базу и удаляет её.
 */
const TEST_DB = String(process.env.TEST_DATABASE_URL || '').trim();
describe.skipIf(!TEST_DB)('Postgres', () => {
  const dbName = `vbi_stage5_test_${process.pid}_${Date.now()}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;

  beforeAll(async () => {
    admin = postgres(TEST_DB, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${dbName}"`);
    const u = new URL(TEST_DB);
    u.pathname = `/${dbName}`;
    await runMigrations(u.toString(), join(__dirname, '../../server/db/migrations'));
    sql = postgres(u.toString(), { max: 3, onnotice: () => {} });
  });
  afterAll(async () => {
    await sql?.end({ timeout: 5 });
    await admin?.unsafe(`drop database if exists "${dbName}" with (force)`);
    await admin?.end({ timeout: 5 });
  });

  const db = () => drizzle(sql, { schema });

  adminContract('Postgres', async () => createPgAdminNotificationsRepo(db()));
  reminderContract('Postgres', async () => {
    await sql`truncate vacations.pre_reminders`;
    return createPgReminderLogRepo(db(), 'pre');
  });
  denylistContract('Postgres', async () => createPgAccessDenylistRepo(db(), { mirrorFile: join(tmp, 'pg-mirror.json') }));

  it('миграции: 5 штук', async () => {
    const [row] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    expect(row!.n).toBe(5);
  });

  it('уведомления админки: seen_at при прочтении, аудит с кем/почему, перенумерация не нужна', async () => {
    await sql`truncate notifications.admin_notifications, audit.audit_log`;
    const repo = createPgAdminNotificationsRepo(db());
    await repo.mutate((items) => items.push(fieldSync, feedback), { reason: 'test-create' });
    await repo.mutate((items) => items.forEach((i) => (i.admin_seen = true)), { actorEmployeeId: 578, reason: 'admin-seen-all' });
    const rows = await sql`select id, position, seen_at from notifications.admin_notifications order by position`;
    expect(rows.map((r) => r.position)).toEqual([0, 1]);
    expect(rows.every((r) => r.seen_at !== null)).toBe(true);
    const audit = await sql`select action, actor_employee_id, after from audit.audit_log
      where entity = 'notifications.admin_notification' order by id`;
    expect(audit.map((r) => [r.action, r.actor_employee_id])).toEqual([
      ['create', null],
      ['create', null],
      ['mark_seen', 578]
    ]);
    expect(audit[2]!.after).toMatchObject({ reason: 'admin-seen-all', ids: [fieldSync.id, feedback.id] });
    // knowledge_ai_degraded «снова не прочитано» → seen_at сбрасывается
    await repo.mutate((items) => {
      items[0]!.admin_seen = false;
    });
    const [r0] = await sql`select seen_at from notifications.admin_notifications where id = ${fieldSync.id}`;
    expect(r0!.seen_at).toBeNull();
  });

  it('импорт уведомлений админки: разовый, поле-в-поле, удалённое не воскресает', async () => {
    await sql`truncate notifications.admin_notifications, notifications.json_imports, audit.audit_log`;
    const file = join(tmp, 'imp-admin.json');
    await writeFile(file, JSON.stringify({ items: [fieldSync, vacationFailed, { ...feedback, extra_field: [1, 2] }, { ...fieldSync, kind: 'дубль id' }, { kind: 'без id' }] }));
    const r1 = await importAdminNotificationsFromJson(db(), file);
    expect(r1).toMatchObject({ status: 'imported', fileCount: 5, inserted: 3, skipped: 2, verified: 3, unseen: 2 });
    const repo = createPgAdminNotificationsRepo(db());
    expect(await repo.readAll()).toEqual([fieldSync, vacationFailed, { ...feedback, extra_field: [1, 2] }]);
    const [seen] = await sql`select count(*)::int as n from notifications.admin_notifications where seen_at is not null`;
    expect(seen!.n).toBe(0); // время прочтения до переезда неизвестно — не выдумываем
    await repo.mutate((items) => {
      items.splice(0, 1);
    });
    const r2 = await importAdminNotificationsFromJson(db(), file);
    expect(r2.status).toBe('already');
    expect((await repo.readAll()).map((i) => i.id)).toEqual([vacationFailed.id, feedback.id]);
  });

  it('импорт журналов: нет файла → 0 строк; есть файл → поле-в-поле; повтор — already', async () => {
    await sql`truncate vacations.pre_reminders, vacations.manager_month_reminders, vacations.json_imports`;
    const none = await importReminderLogFromJson(db(), 'manager-month', join(tmp, 'нет-файла.json'));
    expect(none).toMatchObject({ status: 'imported', fileCount: 0, inserted: 0, skipped: 0, verified: 0 });
    const file = join(tmp, 'imp-pre.json');
    await writeFile(file, JSON.stringify({ version: 1, sent: [preRow('a', 1), preRow('b', 'x'), preRow('a', 2), { kind: 'без key' }] }));
    const r = await importReminderLogFromJson(db(), 'pre', file);
    expect(r).toMatchObject({ status: 'imported', fileCount: 4, inserted: 2, skipped: 2, verified: 2 });
    expect(await createPgReminderLogRepo(db(), 'pre').readAll()).toEqual([preRow('a', 1), preRow('b', 'x')]);
    expect((await importReminderLogFromJson(db(), 'pre', file)).status).toBe('already');
  });

  it('стоп-лист: импорт, кэш, зеркало в JSON, аудит, сбой базы → последний список', async () => {
    await sql`truncate core.access_denylist, core.json_imports, audit.audit_log`;
    const file = join(tmp, 'imp-denylist.json');
    await writeFile(file, JSON.stringify({ entries: [revoked(1), revoked(2, { avatar_purged: true })] }));
    const r = await importAccessDenylistFromJson(db(), file);
    expect(r).toMatchObject({ status: 'imported', fileCount: 2, inserted: 2, skipped: 0, verified: 2 });
    expect((await importAccessDenylistFromJson(db(), file)).status).toBe('already');

    const repo = createPgAccessDenylistRepo(db(), { mirrorFile: file });
    expect(await repo.read()).toEqual([revoked(1), revoked(2, { avatar_purged: true })]);
    await repo.mutate((e) => [...e, revoked(3)], { actorEmployeeId: 578, reason: 'removed-from-roster:admin-employees' });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ entries: [revoked(1), revoked(2, { avatar_purged: true }), revoked(3)] });
    const audit = await sql`select action, entity_id, actor_employee_id from audit.audit_log where entity = 'core.access_denylist' and action <> 'import_json'`;
    expect(audit.map((a) => [a.action, a.entity_id, a.actor_employee_id])).toEqual([['upsert', '3', 578]]);

    // Кэш: правка мимо приложения не видна до TTL; при сбое базы — последний прочитанный список.
    await sql`delete from core.access_denylist`;
    expect(await repo.read()).toHaveLength(3);
    const dead = postgres('postgres://127.0.0.1:1/none', { max: 1, connect_timeout: 1, onnotice: () => {} });
    try {
      const flaky = createPgAccessDenylistRepo(db(), { mirrorFile: null, cacheTtlMs: 0 });
      await flaky.mutate(() => [revoked(5)]);
      expect(await flaky.read()).toEqual([revoked(5)]);
      // подменяем базу на недоступную через новый репозиторий с тем же кэшем нельзя — проверяем отдельный путь:
      const noDb = createPgAccessDenylistRepo(drizzle(dead, { schema }), { mirrorFile: null, cacheTtlMs: 0 });
      await expect(noDb.read()).rejects.toBeTruthy(); // ни кэша, ни зеркала — честная ошибка, не пустой список
    } finally {
      await dead.end({ timeout: 1 });
    }
  });
});
