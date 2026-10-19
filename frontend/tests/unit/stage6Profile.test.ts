import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../server/db/schema';
import { runMigrations } from '../../server/db/migrate';
import {
  createJsonKeyedListRepo,
  createPgKeyedListRepo,
  redactDbError,
  type KeyedListDef,
  type KeyedListRepo
} from '../../server/db/repositories/keyedList';
import {
  PROFILE_ACTIVITY_DEF,
  SALES_BEST_AWARDS_DEF,
  USER_AVATARS_DEF,
  VIBE_PASSWORDS_DEF,
  avatarEntriesFromMap,
  avatarMapFromEntries,
  profileActivityJsonIo,
  salesBestJsonIo,
  userAvatarsJsonIo,
  vibePasswordsJsonIo,
  type AvatarEntry,
  type ProfileActivityRaw,
  type SalesBestAwardRaw,
  type VibePasswordEntry
} from '../../server/profile/domains';
import {
  importProfileActivityFromJson,
  importSalesBestAwardsFromJson,
  importUserAvatarsFromJson,
  importVibePasswordsFromJson
} from '../../server/profile/importJson';

const act = (id: string, extra: Record<string, unknown> = {}): ProfileActivityRaw => ({
  id,
  employee_id: 9100,
  platform_user_id: 9100,
  kind: 'talk',
  text: `Запись ${id}`,
  occurred_at: '2026-07-18T10:00:00.000Z',
  source: 'seed',
  created_at: '2026-07-18T10:00:00.000Z',
  ...extra
});

const award = (period: string, extra: Record<string, unknown> = {}): SalesBestAwardRaw => ({
  id: `aw-${period}`,
  period,
  employee_id: 501,
  employee_name: 'Продажник Иван',
  selected_at: '2026-09-30T09:00:00.000Z',
  selected_by: 578,
  reveal_on: '2026-10-01',
  ...extra
});

/** Фиктивные значения формата хеша/seal (не настоящие пароли). */
const FAKE_HASH = 'scrypt$16384$8$1$c2FsdHNhbHQ$aGFzaGhhc2hoYXNo';
const FAKE_SEAL = 'v1$aXZpdg$dGFndGFn$Y2lwaGVy';
const pw = (employee_id: number, extra: Partial<VibePasswordEntry> = {}): VibePasswordEntry => ({
  employee_id,
  password_hash: `${FAKE_HASH}${employee_id}`,
  password_seal: `${FAKE_SEAL}${employee_id}`,
  updated_at: '2026-10-01T10:00:00.000Z',
  ...extra
});

describe('маппинг профиля JSON ↔ строка (байт-в-байт)', () => {
  const roundtrip = <T>(def: KeyedListDef<T>, item: T) => {
    const row = def.toRow(JSON.parse(JSON.stringify(item)) as T, 0)!;
    expect(row).not.toBeNull();
    return JSON.stringify(def.fromRow(row as never));
  };

  it('лента: порядок ключей, null ≠ отсутствует, чужой тип и неизвестное — в extra', () => {
    const a = act('x', { platform_user_id: null, created_by_user_id: 578, created_by_name: 'HR' });
    expect(roundtrip(PROFILE_ACTIVITY_DEF, a)).toBe(JSON.stringify(a));
    const odd = { id: 'y', text: 'abc', kind: 'conference', occurred_at: '18.07.2026', employee_id: '9100', foo: [1] };
    expect(roundtrip(PROFILE_ACTIVITY_DEF, odd as never)).toBe(JSON.stringify(odd));
    const row = PROFILE_ACTIVITY_DEF.toRow(odd as never, 0)!;
    expect(row.extra).toEqual({ occurred_at: '18.07.2026', employee_id: '9100', foo: [1] });
    expect(PROFILE_ACTIVITY_DEF.toRow({ text: 'без id' } as never, 0)).toBeNull();
  });

  it('награды: undefined не хранится, reveal_on строкой', () => {
    const a = JSON.parse(JSON.stringify(award('2026-09', { activity_id: undefined }))) as SalesBestAwardRaw;
    expect(roundtrip(SALES_BEST_AWARDS_DEF, a)).toBe(JSON.stringify(a));
    expect(roundtrip(SALES_BEST_AWARDS_DEF, award('2026-08', { activity_id: 'sales-best-2026-08' }))).toBe(
      JSON.stringify(award('2026-08', { activity_id: 'sales-best-2026-08' }))
    );
  });

  it('пароли: хеш и seal переносятся как есть; запись без seal остаётся без seal', () => {
    expect(roundtrip(VIBE_PASSWORDS_DEF, pw(7))).toBe(JSON.stringify(pw(7)));
    const old = { employee_id: 8, password_hash: FAKE_HASH, updated_at: '2026-01-01T00:00:00.000Z' };
    expect(roundtrip(VIBE_PASSWORDS_DEF, old as never)).toBe(JSON.stringify(old));
    expect(VIBE_PASSWORDS_DEF.toRow({ employee_id: '8' } as never, 0)).toBeNull();
  });

  it('аватары: карта → пары → карта, невалидные отбрасываются как раньше', () => {
    const map = { '2': 'character_12', '1': 'character_10', '3': 'bad', '4': 5 };
    const entries = avatarEntriesFromMap(map);
    expect(entries).toEqual([
      { user_id: '1', character_id: 'character_10' },
      { user_id: '2', character_id: 'character_12' }
    ]);
    expect(avatarMapFromEntries(entries)).toEqual({ '1': 'character_10', '2': 'character_12' });
  });

  it('ошибка базы для секретов — без текста запроса и параметров', () => {
    const err = Object.assign(new Error(`Failed query: insert ...\nparams: ${FAKE_HASH}`), { cause: { code: '23505' } });
    const safe = redactDbError(err, 'vibe-passwords');
    expect(safe.message).toBe('[vibe-passwords] ошибка базы (23505)');
    expect(safe.message).not.toContain('scrypt');
  });
});

let tmp = '';
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'vbi-stage6-'));
});
afterAll(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

function listContract<T>(name: string, makeRepo: () => Promise<KeyedListRepo<T>>, a: T, b: T, c: T, editB: (x: T) => void) {
  describe(`контракт списка: ${name}`, () => {
    let repo: KeyedListRepo<T>;
    beforeAll(async () => {
      repo = await makeRepo();
    });

    it('добавление, порядок, результат fn', async () => {
      const r = await repo.mutate((items) => {
        items.splice(0, items.length, a, b);
        return 'ok';
      });
      expect(r).toBe('ok');
      expect(await repo.read()).toEqual([a, b]);
    });

    it('правка на месте, удаление из середины, новые в конец', async () => {
      await repo.mutate((items) => {
        items.push(c);
        editB(items[1]!);
        items.splice(0, 1);
      });
      const expectedB = structuredClone(b);
      editB(expectedB);
      expect(await repo.read()).toEqual([expectedB, c]);
    });

    it('ошибка в fn ничего не пишет; чтение — копия', async () => {
      const before = await repo.read();
      await expect(
        repo.mutate((items) => {
          items.splice(0, items.length);
          throw new Error('стоп');
        })
      ).rejects.toThrow('стоп');
      const after = await repo.read();
      expect(after).toEqual(before);
      after.splice(0, after.length);
      expect(await repo.read()).toEqual(before);
    });
  });
}

const avatarA: AvatarEntry = { user_id: '1', character_id: 'character_10' };
const avatarB: AvatarEntry = { user_id: '2', character_id: 'character_12' };
const avatarC: AvatarEntry = { user_id: '9100', character_id: 'character_40' };
const editAvatar = (x: AvatarEntry) => (x.character_id = 'character_01');
const editAct = (x: ProfileActivityRaw) => (x.kind = 'achievement');
const editAward = (x: SalesBestAwardRaw) => (x.activity_id = `sales-best-${x.period}`);
const editPw = (x: VibePasswordEntry) => (x.password_seal = `${FAKE_SEAL}new`);

listContract('аватары JSON', async () => createJsonKeyedListRepo(userAvatarsJsonIo(join(tmp, 'avatars.json'))), avatarA, avatarB, avatarC, editAvatar);
listContract('лента JSON', async () => createJsonKeyedListRepo(profileActivityJsonIo(join(tmp, 'activity.json'), () => [])), act('a'), act('b'), act('c'), editAct);
listContract('награды JSON', async () => createJsonKeyedListRepo(salesBestJsonIo(join(tmp, 'awards.json'))), award('2026-07'), award('2026-08'), award('2026-09'), editAward);
listContract('пароли JSON', async () => createJsonKeyedListRepo(vibePasswordsJsonIo(join(tmp, 'pw.json'))), pw(1), pw(2), pw(3), editPw);

describe('JSON-файлы профиля: формат файла не поменялся', () => {
  it('аватары — карта, лента — {items}, награды — {awards}, пароли — {entries}', async () => {
    expect(JSON.parse(await readFile(join(tmp, 'avatars.json'), 'utf8'))).toEqual({ '2': 'character_01', '9100': 'character_40' });
    expect(Object.keys(JSON.parse(await readFile(join(tmp, 'activity.json'), 'utf8')))).toEqual(['items']);
    expect(Object.keys(JSON.parse(await readFile(join(tmp, 'awards.json'), 'utf8')))).toEqual(['awards']);
    expect(Object.keys(JSON.parse(await readFile(join(tmp, 'pw.json'), 'utf8')))).toEqual(['entries']);
  });
});

/**
 * Postgres-часть: только при TEST_DATABASE_URL (локально vbi_dev). В CI базы нет — пропускается.
 * Тест создаёт себе отдельную временную базу и удаляет её.
 */
const TEST_DB = String(process.env.TEST_DATABASE_URL || '').trim();
describe.skipIf(!TEST_DB)('Postgres', () => {
  const dbName = `vbi_stage6_test_${process.pid}_${Date.now()}`;
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

  listContract('аватары Postgres', async () => createPgKeyedListRepo(db(), USER_AVATARS_DEF), avatarA, avatarB, avatarC, editAvatar);
  listContract('лента Postgres', async () => createPgKeyedListRepo(db(), PROFILE_ACTIVITY_DEF), act('a'), act('b'), act('c'), editAct);
  listContract('награды Postgres', async () => createPgKeyedListRepo(db(), SALES_BEST_AWARDS_DEF), award('2026-07'), award('2026-08'), award('2026-09'), editAward);
  listContract('пароли Postgres', async () => createPgKeyedListRepo(db(), VIBE_PASSWORDS_DEF), pw(1), pw(2), pw(3), editPw);

  it('миграции: этапы 0–6 на месте, схема profile', async () => {
    const [row] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    expect(row!.n).toBeGreaterThanOrEqual(6);
    const tables = await sql`select table_name from information_schema.tables where table_schema = 'profile' order by 1`;
    expect(tables.map((t) => t.table_name)).toEqual(['activity', 'json_imports', 'sales_best_awards', 'user_avatars', 'vibe_passwords']);
  });

  it('запись — только изменения: неизменённые строки не трогаются', async () => {
    await sql`truncate profile.activity, audit.audit_log`;
    const repo = createPgKeyedListRepo(db(), PROFILE_ACTIVITY_DEF);
    await repo.mutate((items) => items.push(act('p1'), act('p2')), { reason: 'test' });
    await sql`update profile.activity set updated_at = '2020-01-01T00:00:00Z'`;
    await repo.mutate((items) => {
      items[1]!.text = 'Поправили';
    }, { actorEmployeeId: 578, reason: 'profile-activity-edit' });
    const rows = await sql`select id, updated_at = '2020-01-01T00:00:00Z'::timestamptz as untouched from profile.activity order by position`;
    expect(rows.map((r) => [r.id, r.untouched])).toEqual([
      ['p1', true],
      ['p2', false]
    ]);
    const audit = await sql`select action, entity_id, actor_employee_id, before, after from audit.audit_log where entity = 'profile.activity' order by id`;
    expect(audit.map((r) => [r.action, r.entity_id, r.actor_employee_id])).toEqual([
      ['create', 'p1', null],
      ['create', 'p2', null],
      ['update', 'p2', 578]
    ]);
    expect(audit[2]!.before).toEqual({ text: 'Запись p2' });
    expect(audit[2]!.after).toEqual({ reason: 'profile-activity-edit', text: 'Поправили' });
  });

  it('пароли: в аудите нет хеша и seal — только факт и кто', async () => {
    await sql`truncate profile.vibe_passwords, audit.audit_log`;
    const repo = createPgKeyedListRepo(db(), VIBE_PASSWORDS_DEF);
    await repo.mutate((e) => e.push(pw(10)), { actorEmployeeId: 578, reason: 'admin-vibe-password-set' });
    await repo.mutate((e) => {
      e[0]!.password_seal = `${FAKE_SEAL}x`;
    }, { actorEmployeeId: 10, reason: 'vibe-login-seal' });
    await repo.mutate((e) => {
      e[0]!.password_hash = `${FAKE_HASH}y`;
    }, { actorEmployeeId: 10, reason: 'self-vibe-password-set' });
    await repo.mutate((e) => e.splice(0, 1), { actorEmployeeId: 578, reason: 'admin-vibe-password-clear' });
    const audit = await sql`select action, entity_id, actor_employee_id, before, after from audit.audit_log where entity = 'profile.vibe_password' order by id`;
    expect(audit.map((r) => [r.action, r.entity_id, r.actor_employee_id])).toEqual([
      ['password_set', '10', 578],
      ['password_seal_added', '10', 10],
      ['password_set', '10', 10],
      ['password_cleared', '10', 578]
    ]);
    const dump = JSON.stringify(audit);
    expect(dump).not.toContain('scrypt');
    expect(dump).not.toContain('v1$');
    expect(audit.every((r) => r.before === null)).toBe(true);
  });

  it('импорт: разовый, поле-в-поле, пропуски считаются, удалённое не воскресает', async () => {
    await sql`truncate profile.user_avatars, profile.activity, profile.sales_best_awards, profile.vibe_passwords, profile.json_imports, audit.audit_log`;
    const fAv = join(tmp, 'imp-avatars.json');
    const fAct = join(tmp, 'imp-activity.json');
    const fAw = join(tmp, 'imp-awards.json');
    const fPw = join(tmp, 'imp-pw.json');
    await writeFile(fAv, JSON.stringify({ '1': 'character_10', '2': 'character_99', '3': 'character_02' }));
    await writeFile(fAct, JSON.stringify({ items: [act('i1'), act('i2', { foo: { a: 1 } }), act('i1'), { text: 'без id' }] }));
    await writeFile(fAw, JSON.stringify({ awards: [award('2026-08', { activity_id: 'sales-best-2026-08' })] }));
    await writeFile(fPw, JSON.stringify({ entries: [pw(1), { employee_id: 2, password_hash: FAKE_HASH, updated_at: '2026-01-01T00:00:00.000Z' }] }));

    expect(await importUserAvatarsFromJson(db(), fAv)).toMatchObject({ status: 'imported', fileCount: 3, inserted: 2, skipped: 1, verified: 2 });
    expect(await importProfileActivityFromJson(db(), fAct)).toMatchObject({ status: 'imported', fileCount: 4, inserted: 2, skipped: 2, verified: 2 });
    expect(await importSalesBestAwardsFromJson(db(), fAw)).toMatchObject({ status: 'imported', fileCount: 1, inserted: 1, skipped: 0, verified: 1 });
    expect(await importVibePasswordsFromJson(db(), fPw)).toMatchObject({ status: 'imported', fileCount: 2, inserted: 2, skipped: 0, verified: 2 });
    expect(await importVibePasswordsFromJson(db(), join(tmp, 'нет-файла.json'))).toMatchObject({ status: 'already' });

    expect(avatarMapFromEntries(await createPgKeyedListRepo(db(), USER_AVATARS_DEF).read())).toEqual({ '1': 'character_10', '3': 'character_02' });
    const pwRepo = createPgKeyedListRepo(db(), VIBE_PASSWORDS_DEF);
    expect(JSON.stringify(await pwRepo.read())).toBe(JSON.stringify(JSON.parse(await readFile(fPw, 'utf8')).entries));
    const actRepo = createPgKeyedListRepo(db(), PROFILE_ACTIVITY_DEF);
    expect(await actRepo.read()).toEqual([act('i1'), act('i2', { foo: { a: 1 } })]);
    await actRepo.mutate((items) => items.splice(0, 1));
    expect((await importProfileActivityFromJson(db(), fAct)).status).toBe('already');
    expect((await actRepo.read()).map((i) => i.id)).toEqual(['i2']);

    const importAudit = await sql`select after from audit.audit_log where action = 'import_json' and entity = 'profile.vibe_password'`;
    expect(importAudit[0]!.after).toEqual({ source: 'vibe-passwords.json', fileCount: 2, inserted: 2, skipped: 0 });
  });

  it('импорт: нет файла → 0 строк', async () => {
    await sql`truncate profile.sales_best_awards, profile.json_imports`;
    expect(await importSalesBestAwardsFromJson(db(), join(tmp, 'нет-файла.json'))).toMatchObject({
      status: 'imported',
      fileCount: 0,
      inserted: 0,
      skipped: 0,
      verified: 0
    });
  });
});
