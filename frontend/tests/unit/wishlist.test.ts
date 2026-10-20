import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WISHLIST_MAX_ITEMS,
  WISHLIST_MAX_TEXT,
  cleanWishText,
  isSafeWishUrl,
  normalizeWishUrl,
  sanitizeStoredWishlist,
  validateWishlistInput,
  wishUrlDomain
} from '../../app/utils/wishlist';

// ---------- окружение для API-хендлеров (Nitro auto-imports) ----------

const h = vi.hoisted(() => ({
  dir: '',
  session: null as null | { id: number; role: string; name: string },
  employees: [
    { id: 11, name: 'Иванова Анна', email: 'anna@vbi.ru' },
    { id: 22, name: 'Петров Пётр', email: 'petr@vbi.ru' }
  ],
  sessionEmployeeId: { 1: 11, 2: 22 } as Record<number, number>
}));

vi.stubGlobal('defineEventHandler', (fn: unknown) => fn);
vi.stubGlobal('createError', (opts: { statusCode: number; statusMessage: string }) =>
  Object.assign(new Error(opts.statusMessage), opts)
);
vi.stubGlobal('readBody', async (event: { body?: unknown }) => event.body);
vi.stubGlobal('getRouterParam', (event: { params?: Record<string, string> }, name: string) => event.params?.[name]);
vi.stubGlobal('getRequestIP', () => '127.0.0.1');

vi.mock('../../server/utils/session', () => ({
  requireVbiSession: async () => {
    if (!h.session) throw Object.assign(new Error('Требуется вход'), { statusCode: 401 });
    return h.session;
  }
}));

vi.mock('../../server/utils/employeesStore', () => ({
  findEmployeeForSession: async (s: { id: number }) =>
    h.employees.find((e) => e.id === h.sessionEmployeeId[s.id]) ?? null,
  findEmployeeById: async (id: number) => h.employees.find((e) => e.id === id) ?? null
}));

vi.mock('../../server/utils/profileStore', async () => {
  const { createJsonKeyedListRepo } = await import('../../server/db/repositories/keyedList');
  const { wishlistsJsonIo } = await import('../../server/profile/domains');
  let repo: ReturnType<typeof createJsonKeyedListRepo> | null = null;
  return {
    wishlistsRepo: async () => (repo ??= createJsonKeyedListRepo(wishlistsJsonIo(join(h.dir, 'wishlists.json'))))
  };
});

const tmpRoot = await mkdtemp(join(tmpdir(), 'vbi-wishlist-'));
h.dir = tmpRoot;
afterAll(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

const { default: getMine } = await import('../../server/api/profile/wishlist.get');
const { default: putMine } = await import('../../server/api/profile/wishlist.put');
const { default: getForEmployee } = await import('../../server/api/employees/[id]/wishlist.get');

type Handler = (event: unknown) => Promise<any>;
const call = (fn: unknown, event: Record<string, unknown> = {}) => (fn as Handler)({ ...event });

// ---------- проверка и чистка ----------

describe('вишлист: ссылки', () => {
  it('http/https принимаются, домен без www', () => {
    expect(normalizeWishUrl('https://www.ozon.ru/product/123')).toBe('https://www.ozon.ru/product/123');
    expect(normalizeWishUrl('http://example.com')).toBe('http://example.com/');
    expect(wishUrlDomain('https://www.ozon.ru/product/123')).toBe('ozon.ru');
  });

  it('домен без протокола → https://', () => {
    expect(normalizeWishUrl('wildberries.ru/catalog/1')).toBe('https://wildberries.ru/catalog/1');
  });

  it('опасные и странные схемы отклоняются', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox',
      'file:///etc/passwd',
      'ftp://example.com',
      'https://user:pass@example.com',
      'https://localhost/x',
      'просто текст',
      'https://exa mple.com'
    ]) {
      expect(normalizeWishUrl(bad), bad).toBeNull();
      expect(isSafeWishUrl(bad), bad).toBe(false);
    }
  });

  it('пустая ссылка — это «нет ссылки», а не ошибка', () => {
    expect(normalizeWishUrl('')).toBe('');
    expect(normalizeWishUrl('   ')).toBe('');
  });
});

describe('вишлист: проверка списка', () => {
  it('текст без управляющих символов, HTML остаётся просто текстом', () => {
    const [item] = validateWishlistInput([{ text: '  <b>Плед</b>\u0000​ в клетку  ', url: '' }]);
    expect(item!.text).toBe('<b>Плед</b> в клетку');
    expect(cleanWishText('a\r\n\r\n\r\n\r\nb')).toBe('a\n\nb');
  });

  it('пустые пункты выкидываются, порядок сохраняется', () => {
    const items = validateWishlistInput([
      { text: 'Первое' },
      { text: '  ', url: '' },
      { url: 'https://ozon.ru/a' },
      { text: 'Третье' }
    ]);
    expect(items.map((i) => i.text || i.url)).toEqual(['Первое', 'https://ozon.ru/a', 'Третье']);
    expect(new Set(items.map((i) => i.id)).size).toBe(3);
  });

  it('плохая ссылка — понятная ошибка с номером пункта', () => {
    expect(() => validateWishlistInput([{ text: 'ok' }, { text: 'x', url: 'javascript:alert(1)' }])).toThrow(
      /Пункт 2/
    );
  });

  it(`текст длиннее ${WISHLIST_MAX_TEXT} и больше ${WISHLIST_MAX_ITEMS} пунктов — ошибка`, () => {
    expect(() => validateWishlistInput([{ text: 'я'.repeat(WISHLIST_MAX_TEXT + 1) }])).toThrow(/не длиннее/);
    const many = Array.from({ length: WISHLIST_MAX_ITEMS + 1 }, (_, i) => ({ text: `п${i}` }));
    expect(() => validateWishlistInput(many)).toThrow(/не больше/);
    expect(validateWishlistInput(many.slice(0, WISHLIST_MAX_ITEMS))).toHaveLength(WISHLIST_MAX_ITEMS);
  });

  it('не список → ошибка; из хранилища битое молча отбрасывается', () => {
    expect(() => validateWishlistInput('строка')).toThrow();
    expect(sanitizeStoredWishlist([{ id: 'w-1', text: 'ok', url: 'javascript:x' }, null, 5])).toEqual([
      { id: 'w-1', text: 'ok', url: '' }
    ]);
  });

  it('чужой id с мусором заменяется', () => {
    const [item] = validateWishlistInput([{ id: '"><img src=x>', text: 'ok' }]);
    expect(item!.id).toMatch(/^w-/);
  });
});

// ---------- API: кто читает и кто пишет ----------

describe('вишлист: API', () => {
  beforeEach(() => {
    h.session = null;
  });

  it('без входа — 401 на чтение и запись', async () => {
    await expect(call(getMine)).rejects.toMatchObject({ statusCode: 401 });
    await expect(call(putMine, { body: { items: [] } })).rejects.toMatchObject({ statusCode: 401 });
    await expect(call(getForEmployee, { params: { id: '11' } })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('владелец сохраняет свой вишлист, коллега читает его в визитке', async () => {
    h.session = { id: 1, role: 'employee', name: 'Анна' };
    const saved = await call(putMine, {
      body: { items: [{ text: 'Книга «Дюна»' }, { text: '', url: 'ozon.ru/item/1' }] }
    });
    expect(saved.employee_id).toBe(11);
    expect(saved.items.map((i: { url: string }) => i.url)).toEqual(['', 'https://ozon.ru/item/1']);

    const file = JSON.parse(await readFile(join(tmpRoot, 'wishlists.json'), 'utf8'));
    expect(file.entries[0].employee_id).toBe(11);

    h.session = { id: 2, role: 'employee', name: 'Пётр' };
    const seen = await call(getForEmployee, { params: { id: '11' } });
    expect(seen.own).toBe(false);
    expect(seen.items).toHaveLength(2);

    const mine = await call(getMine);
    expect(mine.employee_id).toBe(22);
    expect(mine.items).toEqual([]);
  });

  it('запись идёт только в свой вишлист: employee_id из тела игнорируется', async () => {
    h.session = { id: 2, role: 'employee', name: 'Пётр' };
    await call(putMine, { body: { employee_id: 11, items: [{ text: 'Подписка на музыку' }] } });
    h.session = { id: 1, role: 'employee', name: 'Анна' };
    const anna = await call(getMine);
    expect(anna.items.map((i: { text: string }) => i.text)).toEqual(['Книга «Дюна»', '']);
    const petr = await call(getForEmployee, { params: { id: '22' } });
    expect(petr.items.map((i: { text: string }) => i.text)).toEqual(['Подписка на музыку']);
  });

  it('плохие данные — 400, вишлист не меняется', async () => {
    h.session = { id: 2, role: 'employee', name: 'Пётр' };
    await expect(
      call(putMine, { body: { items: [{ text: 'x', url: 'javascript:alert(document.cookie)' }] } })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect((await call(getMine)).items).toHaveLength(1);
  });

  it('пустой список очищает вишлист; на своей визитке own=true', async () => {
    h.session = { id: 2, role: 'employee', name: 'Пётр' };
    const cleared = await call(putMine, { body: { items: [] } });
    expect(cleared.items).toEqual([]);
    const own = await call(getForEmployee, { params: { id: '22' } });
    expect(own.own).toBe(true);
  });

  it('несуществующий или кривой id сотрудника — 404/400', async () => {
    h.session = { id: 1, role: 'employee', name: 'Анна' };
    await expect(call(getForEmployee, { params: { id: '999' } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(call(getForEmployee, { params: { id: 'abc' } })).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ---------- Postgres (только при TEST_DATABASE_URL; в CI пропускается) ----------

const TEST_DB = String(process.env.TEST_DATABASE_URL || '').trim();
describe.skipIf(!TEST_DB)('вишлист: Postgres', () => {
  const dbName = `vbi_wishlist_test_${process.pid}_${Date.now()}`;
  let admin: import('postgres').Sql;
  let sql: import('postgres').Sql;
  let db: () => any;

  beforeAll(async () => {
    const postgres = (await import('postgres')).default;
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const schema = await import('../../server/db/schema');
    const { runMigrations } = await import('../../server/db/migrate');
    admin = postgres(TEST_DB, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${dbName}"`);
    const u = new URL(TEST_DB);
    u.pathname = `/${dbName}`;
    await runMigrations(u.toString(), join(__dirname, '../../server/db/migrations'));
    sql = postgres(u.toString(), { max: 3, onnotice: () => {} });
    db = () => drizzle(sql, { schema });
  });
  afterAll(async () => {
    await sql?.end({ timeout: 5 });
    await admin?.unsafe(`drop database if exists "${dbName}" with (force)`);
    await admin?.end({ timeout: 5 });
  });

  it('запись, чтение, аудит и разовый импорт из файла', async () => {
    const { createPgKeyedListRepo } = await import('../../server/db/repositories/keyedList');
    const { WISHLISTS_DEF } = await import('../../server/profile/domains');
    const { importWishlistsFromJson } = await import('../../server/profile/importJson');
    const { writeFile } = await import('node:fs/promises');

    const file = join(tmpRoot, 'import-wishlists.json');
    const entry = {
      employee_id: 5,
      items: [{ id: 'w-a', text: 'Плед', url: 'https://ozon.ru/x' }],
      updated_at: '2026-10-01T10:00:00.000Z'
    };
    await writeFile(file, JSON.stringify({ entries: [entry, { employee_id: 'bad', items: [] }] }));
    expect(await importWishlistsFromJson(db(), file)).toMatchObject({
      status: 'imported',
      fileCount: 2,
      inserted: 1,
      skipped: 1,
      verified: 1
    });

    const repo = createPgKeyedListRepo(db(), WISHLISTS_DEF);
    expect(await repo.read()).toEqual([entry]);
    await repo.mutate(
      (e) => {
        e[0]!.items = [{ id: 'w-b', text: 'Книга', url: '' }];
      },
      { actorEmployeeId: 5, reason: 'self-wishlist-set' }
    );
    expect((await repo.read())[0]!.items).toEqual([{ id: 'w-b', text: 'Книга', url: '' }]);
    const audit = await sql`select action, actor_employee_id from audit.audit_log where entity = 'profile.wishlist' order by id`;
    expect(audit.map((r) => [r.action, r.actor_employee_id])).toEqual([
      ['import_json', null],
      ['wishlist_set', 5]
    ]);
  });
});
