import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../server/db/schema';
import { runMigrations } from '../../server/db/migrate';
import { createPgUserNotificationsRepo } from '../../server/db/repositories/userNotifications';
import { createJsonUserNotificationsRepo } from '../../server/notifications/jsonStore';
import { importUserNotificationsFromJson } from '../../server/notifications/importJson';
import { notificationToRow, rowToNotification } from '../../server/notifications/rowMapping';
import { USER_NOTIFICATIONS_MAX_PER_RECIPIENT, type UserNotificationsRepo } from '../../server/notifications/types';

const sample = {
  kind: 'vacation_deleted',
  recipient_user_id: 2,
  vacation_request_id: 9106,
  employee_name: 'Даша Тестова',
  start: '2026-12-07',
  end: '2026-12-13',
  id: 'f63f0ab7-8055-45ca-81ca-73d4ed80c52a',
  created_at: '2026-07-13T11:33:42.503Z',
  seen: true,
  hidden_from_bell: true
};

describe('маппинг JSON ↔ строка БД', () => {
  it('туда-обратно без потерь', () => {
    const row = notificationToRow(sample)!;
    expect(row).not.toBeNull();
    expect(rowToNotification(row)).toEqual(sample);
  });

  it('неизвестные поля и кривые даты уходят в extra, а не теряются', () => {
    const row = notificationToRow({ ...sample, start: '07.12.2026', foo: { a: 1 } })!;
    expect(row.startDate).toBeNull();
    expect(row.extra).toEqual({ start: '07.12.2026', foo: { a: 1 } });
    const back = rowToNotification(row) as Record<string, unknown>;
    expect(back.start).toBe('07.12.2026');
    expect(back.foo).toEqual({ a: 1 });
  });

  it('без id / получателя / даты запись не придумываем — null', () => {
    expect(notificationToRow({ ...sample, id: 'abc' })).toBeNull();
    expect(notificationToRow({ ...sample, recipient_user_id: 'x' })).toBeNull();
    expect(notificationToRow({ ...sample, created_at: 'never' })).toBeNull();
  });

  it('отсутствующий hidden_from_bell → false', () => {
    const { hidden_from_bell: _h, ...rest } = sample;
    expect(rowToNotification(notificationToRow(rest)!).hidden_from_bell).toBe(false);
  });
});

/** Общий контракт хранилища — одинаково для JSON и Postgres. */
function contract(name: string, makeRepo: () => Promise<UserNotificationsRepo>, base: number) {
  describe(`контракт хранилища: ${name}`, () => {
    let repo: UserNotificationsRepo;
    const me = base + 1;
    const other = base + 2;
    beforeAll(async () => {
      repo = await makeRepo();
      await repo.deleteForRecipients([me, other]);
    });
    afterAll(async () => {
      await repo?.deleteForRecipients([me, other]);
    });

    it('create → list (новые сверху) → count → seen → hide → dismiss', async () => {
      const a = await repo.create({ kind: 'vacation_submitted', recipient_user_id: me, employee_name: 'А', start: '2026-11-02', end: '2026-11-06', vacation_request_id: 7 });
      await new Promise((r) => setTimeout(r, 5));
      const b = await repo.create({ kind: 'idea_status_changed', recipient_user_id: me, employee_name: 'Б', idea_id: 'i1', idea_title: 'Идея' });
      await repo.create({ kind: 'vacation_submitted', recipient_user_id: other, employee_name: 'В' });

      const list = await repo.list(me);
      expect(list.map((n) => n.id)).toEqual([b.id, a.id]);
      expect(list[1]).toMatchObject({ start: '2026-11-02', end: '2026-11-06', vacation_request_id: 7, seen: false, hidden_from_bell: false });
      expect(await repo.countUnseen([me, other])).toBe(3);

      expect((await repo.markSeen(me, a.id))?.seen).toBe(true);
      expect(await repo.markSeen(other, b.id)).toBeNull(); // чужое не трогаем
      expect(await repo.countUnseen(me)).toBe(1);

      const hidden = await repo.hideFromBell(me, b.id);
      expect(hidden).toMatchObject({ hidden_from_bell: true, seen: true });
      expect((await repo.list(me, { forBell: true })).map((n) => n.id)).toEqual([a.id]);
      expect(await repo.list(me, { unseen: true })).toEqual([]);

      expect(await repo.markAllSeen(other)).toBe(1);
      expect(await repo.dismiss(other, a.id)).toBe(false);
      expect(await repo.dismiss(me, a.id)).toBe(true);
      expect((await repo.list(me)).map((n) => n.id)).toEqual([b.id]);
      expect(await repo.markSeen(me, 'not-a-uuid')).toBeNull();
    });

    it(`лимит ${USER_NOTIFICATIONS_MAX_PER_RECIPIENT} на получателя и офбординг`, async () => {
      await repo.deleteForRecipients([me]);
      for (let i = 0; i < USER_NOTIFICATIONS_MAX_PER_RECIPIENT + 2; i += 1) {
        await repo.create({ kind: 'post_vacation_memo', recipient_user_id: me, employee_name: String(i), vacation_request_id: i });
      }
      const list = await repo.list(me);
      expect(list).toHaveLength(USER_NOTIFICATIONS_MAX_PER_RECIPIENT);
      expect(list.some((n) => n.vacation_request_id === 0)).toBe(false);
      expect(await repo.deleteForRecipients([me])).toBe(USER_NOTIFICATIONS_MAX_PER_RECIPIENT);
      expect(await repo.list(me)).toEqual([]);
    });
  });
}

let tmp = '';
contract(
  'JSON',
  async () => {
    tmp = await mkdtemp(join(tmpdir(), 'vbi-notif-'));
    return createJsonUserNotificationsRepo(join(tmp, 'user-notifications.json'));
  },
  1000
);
afterAll(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

/**
 * Postgres-часть: только при TEST_DATABASE_URL (локально vbi_dev). В CI базы нет — пропускается.
 * Пишет строки с recipient 990000001+ и сама за собой их удаляет.
 */
const TEST_DB = String(process.env.TEST_DATABASE_URL || '').trim();
const sql = TEST_DB ? postgres(TEST_DB, { max: 2, onnotice: () => {} }) : null;
describe.skipIf(!TEST_DB)('Postgres', () => {
  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  contract(
    'Postgres',
    async () => {
      await runMigrations(TEST_DB, join(__dirname, '../../server/db/migrations'));
      return createPgUserNotificationsRepo(drizzle(sql!, { schema }));
    },
    990_000_000
  );

  it('аудит пишет создание', async () => {
    const repo = createPgUserNotificationsRepo(drizzle(sql!, { schema }));
    const n = await repo.create({ kind: 'vacation_approved', recipient_user_id: 990_000_009, employee_name: 'Аудит' });
    const rows = await sql!`select action from audit.audit_log where entity = 'notifications.user_notification' and entity_id = ${n.id}`;
    expect(rows.map((r) => r.action)).toEqual(['create']);
    await repo.deleteForRecipients([990_000_009]);
  });

  it('импорт из JSON: разовый, без дублей, кривые записи пропускаются', async () => {
    const db = drizzle(sql!, { schema });
    const source = `test-import-${Date.now()}`;
    const dir = await mkdtemp(join(tmpdir(), 'vbi-notif-imp-'));
    const file = join(dir, 'user-notifications.json');
    const good = { ...sample, recipient_user_id: 990_000_010, id: '00000000-0000-4000-8000-990000000010' };
    const good2 = { ...good, id: '00000000-0000-4000-8000-990000000011', seen: false };
    await writeFile(file, JSON.stringify({ items: [good, good2, { ...good, id: 'bad' }, good] }));
    try {
      const r1 = await importUserNotificationsFromJson(db, file, source);
      expect(r1).toMatchObject({ status: 'imported', fileCount: 4, inserted: 2, skipped: 2, verifiedInDb: 2 });
      const repo = createPgUserNotificationsRepo(db);
      expect((await repo.list(990_000_010)).find((n) => n.id === good.id)).toEqual(good);
      await repo.dismiss(990_000_010, good.id);
      const r2 = await importUserNotificationsFromJson(db, file, source);
      expect(r2.status).toBe('already');
      expect(await repo.list(990_000_010)).toHaveLength(1); // удалённое не воскресло
    } finally {
      await createPgUserNotificationsRepo(db).deleteForRecipients([990_000_010]);
      await sql!`delete from notifications.json_imports where source = ${source}`;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
