import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../server/db/schema';
import { runMigrations } from '../../server/db/migrate';
import {
  assembleState,
  createJsonStateRepo,
  createPgStateRepo,
  splitState,
  type RawState,
  type StateRepo
} from '../../server/db/repositories/keyedState';
import { IDEA_DEF, ideasJsonIo, importIdeasFromJson } from '../../server/ideas/domain';
import { KNOWLEDGE_ARTICLE_DEF, importKnowledgeArticlesFromJson, knowledgeJsonIo } from '../../server/knowledge/domain';
import { IDEAS_STATE_FULL_DEF, normalizeIdeasStoreState, type IdeasStoreState } from '../../server/utils/ideasStore';
import {
  KNOWLEDGE_STATE_FULL_DEF,
  normalizeKnowledgeArticlesState,
  type KnowledgeArticle,
  type KnowledgeArticlesState
} from '../../server/utils/knowledgeArticlesStore';
import type { Idea } from '../../app/composables/useIdeasBank';
import { applyKnowledgeSeedToDb, mergeKnowledgeSeed } from '../../server/knowledge/seedSync';

const DATA_DIR = join(__dirname, '../../server/data');

/** Как mutateIdeas / mutateKnowledgeArticles: нормализация до и после fn (без проверки вложений на диске). */
function storeMutate<S>(repo: StateRepo, normalize: (raw: RawState) => S, fn: (s: S) => S | void, ctx = {}) {
  return repo.mutate(async (raw) => {
    const cur = normalize(raw);
    const next = normalize((fn(cur) ?? cur) as unknown as RawState);
    return { next: next as unknown as RawState, result: next };
  }, ctx);
}
const normIdeas = (raw: RawState) => normalizeIdeasStoreState(raw as Partial<IdeasStoreState>);
const normKb = (raw: RawState) => normalizeKnowledgeArticlesState(raw as Partial<KnowledgeArticlesState>);

const idea = (n: number, extra: Partial<Idea> = {}): Idea => ({
  id: `idea-${n}`,
  authorUserId: 3,
  authorName: 'Автор',
  title: `Идея ${n}`,
  description: 'Описание идеи достаточной длины',
  category: 'Офисная среда',
  city: 'Москва',
  status: 'review',
  createdAt: '2026-10-01',
  votesUp: 0,
  votesDown: 0,
  attachmentStored: false,
  ...extra
});

const article = (id: string, extra: Partial<KnowledgeArticle> = {}): KnowledgeArticle => ({
  id,
  title: `Статья ${id}`,
  summary: 'Кратко',
  body: '<p>Текст статьи</p>',
  tags: ['a', 'b'],
  breadcrumbs: ['Раздел'],
  departments: [],
  status: 'published',
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  authorName: 'Администратор',
  authorUserId: 578,
  comments: [],
  pendingRevision: null,
  approvedAt: null,
  rejectionReason: null,
  submittedAt: null,
  closedAt: null,
  ...extra
});

/** Сценарий правок банка идей; снимок после каждого шага (что видит API). */
async function ideasScenario(repo: StateRepo): Promise<string[]> {
  const snaps: string[] = [];
  const snap = async () => snaps.push(JSON.stringify(normIdeas(await repo.read())));
  await storeMutate(repo, normIdeas, (s) => {
    s.ideas = [idea(2), idea(1, { attachmentName: 'план.pdf', attachmentStored: true })];
    s.nextIdeaId = 3;
  });
  await snap();
  // голос, снятие голоса (пустая карта пользователя остаётся), голос другого
  await storeMutate(repo, normIdeas, (s) => {
    s.votesByUserId['5'] = { 'idea-1': 'up' };
    s.ideas[1]!.votesUp = 1;
  });
  await storeMutate(repo, normIdeas, (s) => {
    s.votesByUserId['5'] = {};
    s.votesByUserId['12'] = { 'idea-2': 'down', 'idea-1': 'up' };
    s.ideas[1]!.votesUp = 1;
    s.ideas[0]!.votesDown = 1;
  });
  await snap();
  await storeMutate(repo, normIdeas, (s) => {
    s.ideas[0]!.status = 'rejected';
    s.ideas[0]!.statusComment = 'Не подходит';
    s.ideas[0]!.statusChangedAt = '2026-10-19T12:00:00.000Z';
  });
  await snap();
  await storeMutate(repo, normIdeas, (s) => {
    s.ideas = s.ideas.filter((i) => i.id !== 'idea-1');
    for (const v of Object.values(s.votesByUserId)) delete v['idea-1'];
  });
  await snap();
  return snaps;
}

async function knowledgeScenario(repo: StateRepo): Promise<string[]> {
  const snaps: string[] = [];
  const snap = async () => snaps.push(JSON.stringify(normKb(await repo.read())));
  await storeMutate(repo, normKb, (s) => {
    s.articles = [article('kb-1'), article('kb-2', { departments: ['Digital'], status: 'draft', authorUserId: 9100 })];
    s.nextId = 3;
  });
  await snap();
  await storeMutate(repo, normKb, (s) => {
    const a = s.articles[0]!;
    a.comments = [{ id: 'c1', authorUserId: 578, authorName: 'Руководитель', quote: 'Текст', body: 'Поправь', createdAt: '2026-10-19T10:00:00.000Z' }];
    a.pendingRevision = {
      title: 'Новая версия',
      summary: '',
      body: '<p>Новый текст</p>',
      tags: [],
      departments: [],
      submittedAt: '2026-10-19T10:00:00.000Z',
      status: 'pending_review'
    };
  });
  await snap();
  await storeMutate(repo, normKb, (s) => {
    s.articles[1]!.status = 'pending_review';
    s.articles[1]!.submittedAt = '2026-10-19T11:00:00.000Z';
    s.articles.push(article('kb-3'));
    s.nextId = 4;
  });
  await snap();
  await storeMutate(repo, normKb, (s) => {
    s.articles = s.articles.filter((a) => a.id !== 'kb-1');
  });
  await snap();
  return snaps;
}

describe('маппинг этапа 7 JSON ↔ строка (байт-в-байт)', () => {
  const roundtrip = (def: typeof IDEA_DEF, item: Record<string, unknown>) =>
    JSON.stringify(def.fromRow(def.toRow(JSON.parse(JSON.stringify(item)), 0) as never));

  it('идея: порядок ключей, чужой тип и неизвестное — в extra', () => {
    const odd = { id: 'idea-9', title: 'x', votesUp: '3', createdAt: '2026-10-01', statusChangedAt: '19.10.2026', foo: { a: 1 } };
    expect(roundtrip(IDEA_DEF, odd)).toBe(JSON.stringify(odd));
    expect(IDEA_DEF.toRow(odd, 0)!.extra).toEqual({ votesUp: '3', statusChangedAt: '19.10.2026', foo: { a: 1 } });
    expect(IDEA_DEF.toRow({ title: 'без id' }, 0)).toBeNull();
  });

  it('статья: массивы, комментарии, null ≠ отсутствует', () => {
    const a = article('kb-7', {
      comments: [{ id: 'c', authorUserId: 1, authorName: 'Р', quote: '', body: 'b', createdAt: 'x' }]
    }) as unknown as Record<string, unknown>;
    expect(roundtrip(KNOWLEDGE_ARTICLE_DEF, a)).toBe(JSON.stringify(a));
    const legacy = { id: 'kb-8', title: 'T', summary: '', body: 'B', tags: [], breadcrumbs: ['x', 1], status: 'review', createdAt: '2025-01-01' };
    expect(roundtrip(KNOWLEDGE_ARTICLE_DEF, legacy)).toBe(JSON.stringify(legacy));
  });

  it('состояние: порядок ключей верхнего уровня и неизвестные ключи', () => {
    const raw = { votesByUserId: { '5': {} }, nextIdeaId: 4, ideas: [idea(1)], note: 'x' };
    const split = splitState(IDEAS_STATE_FULL_DEF, raw);
    const lists = new Map<string, unknown[]>();
    for (const part of IDEAS_STATE_FULL_DEF.parts) {
      lists.set(part.prop, (split.lists.get(part.prop) ?? []).map((i) => part.def.fromRow(part.def.toRow(i as never, 0) as never)));
    }
    expect(JSON.stringify(assembleState(IDEAS_STATE_FULL_DEF, split.meta, lists))).toBe(JSON.stringify(raw));
    // ideas не массив → лежит в extra как есть
    const broken = { ideas: 'oops', nextIdeaId: 1 };
    const s2 = splitState(IDEAS_STATE_FULL_DEF, broken);
    expect(JSON.stringify(assembleState(IDEAS_STATE_FULL_DEF, s2.meta, new Map()))).toBe(JSON.stringify(broken));
    expect(JSON.stringify(assembleState(IDEAS_STATE_FULL_DEF, splitState(IDEAS_STATE_FULL_DEF, {}).meta, new Map()))).toBe('{}');
  });
});

let tmp = '';
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'vbi-stage7-'));
});
afterAll(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

describe('JSON-бэкенд этапа 7', () => {
  it('идеи: сценарий, формат файла не поменялся, ошибка fn ничего не пишет', async () => {
    const file = join(tmp, 'ideas.json');
    const repo = createJsonStateRepo(ideasJsonIo(file));
    const snaps = await ideasScenario(repo);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(JSON.parse(snaps.at(-1)!));
    expect(Object.keys(JSON.parse(await readFile(file, 'utf8')))).toEqual(['ideas', 'nextIdeaId', 'votesByUserId']);
    const before = await readFile(file, 'utf8');
    await expect(
      storeMutate(repo, normIdeas, (s) => {
        s.ideas = [];
        throw new Error('стоп');
      })
    ).rejects.toThrow('стоп');
    expect(await readFile(file, 'utf8')).toBe(before);
  });

  it('база знаний: сценарий, формат файла {articles, nextId}', async () => {
    const file = join(tmp, 'kb.json');
    const snaps = await knowledgeScenario(createJsonStateRepo(knowledgeJsonIo(file)));
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(JSON.parse(snaps.at(-1)!));
    expect(Object.keys(JSON.parse(await readFile(file, 'utf8')))).toEqual(['articles', 'nextId']);
  });
});

/**
 * Postgres-часть: только при TEST_DATABASE_URL (локально vbi_dev). В CI базы нет — пропускается.
 * Тест создаёт себе отдельную временную базу и удаляет её.
 */
const TEST_DB = String(process.env.TEST_DATABASE_URL || '').trim();
describe.skipIf(!TEST_DB)('Postgres', () => {
  const dbName = `vbi_stage7_test_${process.pid}_${Date.now()}`;
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
  const truncateAll = () =>
    sql`truncate ideas.ideas, ideas.user_votes, ideas.state, ideas.json_imports, knowledge.articles, knowledge.state, knowledge.json_imports, audit.audit_log`;

  it('миграции: 7 штук, схемы ideas и knowledge', async () => {
    const [row] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    expect(row!.n).toBe(7);
    const tables = await sql`select table_schema || '.' || table_name as t from information_schema.tables where table_schema in ('ideas', 'knowledge') order by 1`;
    expect(tables.map((t) => t.t)).toEqual([
      'ideas.ideas',
      'ideas.json_imports',
      'ideas.state',
      'ideas.user_votes',
      'knowledge.articles',
      'knowledge.json_imports',
      'knowledge.state'
    ]);
  });

  it('контракт: тот же сценарий на JSON и Postgres даёт байт-в-байт тот же ответ', async () => {
    await truncateAll();
    const jsonIdeas = await ideasScenario(createJsonStateRepo(ideasJsonIo(join(tmp, 'c-ideas.json'))));
    const pgIdeas = await ideasScenario(createPgStateRepo(db(), IDEAS_STATE_FULL_DEF));
    expect(pgIdeas).toEqual(jsonIdeas);
    const jsonKb = await knowledgeScenario(createJsonStateRepo(knowledgeJsonIo(join(tmp, 'c-kb.json'))));
    const pgKb = await knowledgeScenario(createPgStateRepo(db(), KNOWLEDGE_STATE_FULL_DEF));
    expect(pgKb).toEqual(jsonKb);
    // пустая карта голосов пользователя сохранилась
    expect((normIdeas(await createPgStateRepo(db(), IDEAS_STATE_FULL_DEF).read())).votesByUserId['5']).toEqual({});
  });

  it('ошибка в fn ничего не пишет; чтение — копия', async () => {
    const repo = createPgStateRepo(db(), KNOWLEDGE_STATE_FULL_DEF);
    const before = JSON.stringify(await repo.read());
    await expect(
      storeMutate(repo, normKb, (s) => {
        s.articles = [];
        throw new Error('стоп');
      })
    ).rejects.toThrow('стоп');
    const after = await repo.read();
    expect(JSON.stringify(after)).toBe(before);
    (after.articles as unknown[]).splice(0);
    expect(JSON.stringify(await repo.read())).toBe(before);
  });

  it('запись diff-ом и аудит кто/почему', async () => {
    await truncateAll();
    const repo = createPgStateRepo(db(), KNOWLEDGE_STATE_FULL_DEF);
    await storeMutate(repo, normKb, (s) => {
      s.articles = [article('kb-1'), article('kb-2')];
      s.nextId = 3;
    }, { actorEmployeeId: 578, reason: 'knowledge:admin-create' });
    await sql`update knowledge.articles set row_updated_at = '2020-01-01T00:00:00Z'`;
    await storeMutate(repo, normKb, (s) => {
      s.articles[1]!.title = 'Поправили';
    }, { actorEmployeeId: 9100, reason: 'knowledge:edit' });
    const rows = await sql`select id, row_updated_at = '2020-01-01T00:00:00Z'::timestamptz as untouched from knowledge.articles order by position`;
    expect(rows.map((r) => [r.id, r.untouched])).toEqual([
      ['kb-1', true],
      ['kb-2', false]
    ]);
    const audit = await sql`select action, entity, entity_id, actor_employee_id, before, after from audit.audit_log order by id`;
    expect(audit.map((r) => [r.action, r.entity, r.entity_id, r.actor_employee_id])).toEqual([
      ['create', 'knowledge.article', 'kb-1', 578],
      ['create', 'knowledge.article', 'kb-2', 578],
      ['create', 'knowledge.state', '1', 578],
      ['update', 'knowledge.article', 'kb-2', 9100]
    ]);
    expect(audit[3]!.before).toEqual({ title: 'Статья kb-2' });
    expect(audit[3]!.after).toEqual({ reason: 'knowledge:edit', title: 'Поправили' });
  });

  it('кэш: запись сразу видна; ручная правка в базе — после TTL', async () => {
    const repo = createPgStateRepo(db(), KNOWLEDGE_STATE_FULL_DEF, { cacheTtlMs: 60_000 });
    const first = normKb(await repo.read());
    await storeMutate(repo, normKb, (s) => {
      s.articles[0]!.summary = 'Через кэш';
    });
    expect(normKb(await repo.read()).articles[0]!.summary).toBe('Через кэш');
    await sql`update knowledge.articles set summary = 'Руками' where id = ${first.articles[0]!.id}`;
    expect(normKb(await repo.read()).articles[0]!.summary).toBe('Через кэш');
    const fresh = createPgStateRepo(db(), KNOWLEDGE_STATE_FULL_DEF, { cacheTtlMs: 0 });
    expect(normKb(await fresh.read()).articles[0]!.summary).toBe('Руками');
  });

  it('импорт реальных файлов из репозитория: то, что видит API, байт-в-байт', async () => {
    await truncateAll();
    const kbFile = join(DATA_DIR, 'knowledge-articles.json');
    const ideasFile = join(DATA_DIR, 'ideas.json');
    const kbRaw = JSON.parse(await readFile(kbFile, 'utf8'));
    const ideasRaw = JSON.parse(await readFile(ideasFile, 'utf8'));
    const rKb = await importKnowledgeArticlesFromJson(db(), KNOWLEDGE_STATE_FULL_DEF, kbFile);
    expect(rKb).toMatchObject({ status: 'imported', fileCount: kbRaw.articles.length, inserted: kbRaw.articles.length, skipped: 0 });
    const rIdeas = await importIdeasFromJson(db(), IDEAS_STATE_FULL_DEF, ideasFile);
    expect(rIdeas).toMatchObject({ status: 'imported', fileCount: ideasRaw.ideas.length, skipped: 0 });

    const kbRepo = createPgStateRepo(db(), KNOWLEDGE_STATE_FULL_DEF);
    expect(JSON.stringify(await kbRepo.read())).toBe(JSON.stringify(kbRaw));
    expect(JSON.stringify(normKb(await kbRepo.read()))).toBe(JSON.stringify(normKb(kbRaw)));
    const ideasRepo = createPgStateRepo(db(), IDEAS_STATE_FULL_DEF);
    expect(JSON.stringify(await ideasRepo.read())).toBe(JSON.stringify(ideasRaw));

    // чтение из кэша: быстро, без запроса в базу на каждый вызов
    const t0 = performance.now();
    for (let i = 0; i < 20; i += 1) normKb(await kbRepo.read());
    const perRead = (performance.now() - t0) / 20;
    expect(perRead).toBeLessThan(100);

    expect((await importKnowledgeArticlesFromJson(db(), KNOWLEDGE_STATE_FULL_DEF, kbFile)).status).toBe('already');
  });

  it('сид из git: то же слияние, что у деплоя на файле; раз на версию сида', async () => {
    await truncateAll();
    const repo = createPgStateRepo(db(), KNOWLEDGE_STATE_FULL_DEF);
    await storeMutate(repo, normKb, (s) => {
      s.articles = [article('kb-1', { title: 'Правка админа' }), article('kb-vibe-vacations')];
      s.nextId = 2;
    });
    const seed = {
      articles: [article('kb-1', { title: 'Из сида' }), article('kb-new'), article('kb-vibe-ideas', { body: '<p>Сид</p>' })],
      nextId: 7
    };
    const before = await repo.read();
    const r = await applyKnowledgeSeedToDb(db(), repo, seed);
    expect(r).toMatchObject({ status: 'applied', changed: true, stats: { added: 2, retired: 1 } });
    const after = await repo.read();
    // байт-в-байт то же, что merge-knowledge-articles-seed.mjs сделал бы с файлом
    const expected = mergeKnowledgeSeed(before, seed).state;
    const strip = (v: unknown) => JSON.stringify(v, (k, x) => (k === 'updatedAt' ? undefined : x));
    expect(strip(after)).toBe(strip(expected));
    expect(normKb(after).articles.map((a) => [a.id, a.title])).toEqual([
      ['kb-1', 'Правка админа'],
      ['kb-new', 'Статья kb-new'],
      ['kb-vibe-ideas', 'Статья kb-vibe-ideas']
    ]);
    expect(normKb(after).nextId).toBe(7);
    // повтор того же сида — ничего; удалённая сид-статья не воскресает
    await storeMutate(repo, normKb, (s) => {
      s.articles = s.articles.filter((a) => a.id !== 'kb-new');
    });
    expect((await applyKnowledgeSeedToDb(db(), repo, seed)).status).toBe('already');
    expect(normKb(await repo.read()).articles.map((a) => a.id)).toEqual(['kb-1', 'kb-vibe-ideas']);
    const audit = await sql`select count(*)::int as n from audit.audit_log where after->>'reason' = 'deploy-seed-merge'`;
    expect(audit[0]!.n).toBeGreaterThan(0);
  });

  it('импорт: отсеянные записи, повтор не воскрешает удалённое, нет файла → пусто', async () => {
    await truncateAll();
    const f = join(tmp, 'imp-kb.json');
    const dup = article('kb-1') as unknown as Record<string, unknown>;
    // запись без id normalize тоже выкидывает → то, что видит API, совпадает
    await writeFile(f, JSON.stringify({ articles: [dup, article('kb-2'), { title: 'без id' }], nextId: 5, note: 'x' }));
    expect(await importKnowledgeArticlesFromJson(db(), KNOWLEDGE_STATE_FULL_DEF, f)).toMatchObject({
      status: 'imported',
      fileCount: 3,
      inserted: 2,
      skipped: 1
    });
    const repo = createPgStateRepo(db(), KNOWLEDGE_STATE_FULL_DEF);
    expect(Object.keys(await repo.read())).toEqual(['articles', 'nextId', 'note']);
    await storeMutate(repo, normKb, (s) => {
      s.articles = s.articles.slice(1);
    });
    expect((await importKnowledgeArticlesFromJson(db(), KNOWLEDGE_STATE_FULL_DEF, f)).status).toBe('already');
    expect(normKb(await repo.read()).articles.map((a) => a.id)).toEqual(['kb-2']);

    // дубль id, который normalize оставил бы → импорт отменяется целиком (остаёмся на JSON)
    await sql`truncate ideas.ideas, ideas.user_votes, ideas.state, ideas.json_imports`;
    const fi = join(tmp, 'imp-ideas.json');
    await writeFile(fi, JSON.stringify({ ideas: [idea(1), idea(1)], nextIdeaId: 2, votesByUserId: {} }));
    await expect(importIdeasFromJson(db(), IDEAS_STATE_FULL_DEF, fi)).rejects.toThrow(/импорт ideas.json/);
    const [n] = await sql`select count(*)::int as n from ideas.ideas`;
    expect(n!.n).toBe(0);

    expect(await importIdeasFromJson(db(), IDEAS_STATE_FULL_DEF, join(tmp, 'нет-файла.json'))).toMatchObject({
      status: 'imported',
      fileCount: 0,
      inserted: 0
    });
    expect(normIdeas(await createPgStateRepo(db(), IDEAS_STATE_FULL_DEF).read())).toEqual({ ideas: [], nextIdeaId: 1, votesByUserId: {} });
  });
});

