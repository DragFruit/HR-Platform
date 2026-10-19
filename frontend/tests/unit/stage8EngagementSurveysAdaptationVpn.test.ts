import { execFileSync } from 'node:child_process';
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
  createPgStateRepo,
  splitState,
  type KeyedStateDef,
  type RawState,
  type StateRepo
} from '../../server/db/repositories/keyedState';
import type { StateFile } from '../../server/db/repositories/stateFile';
import { PIT_STOP_PAIR_DEF, PIT_STOP_PLAYER_DEF, PIT_STOP_RACE_RECORD_DEF } from '../../server/engagement/domain';
import { SURVEY_DEF, SURVEY_RESPONSE_DEF } from '../../server/surveys/domain';
import { ADAPTATION_ATTEMPT_DEF, ADAPTATION_STEP_DEF } from '../../server/adaptation/domain';
import { VPN_KEY_DEF, assertVpnMetadataOnly } from '../../server/vpn/domain';
import { createPair, emptyPlayer, normalizePitStopState, pitStopFile, PIT_STOP_STATE_FULL_DEF } from '../../server/utils/pitStopStore';
import { normalizeRaceState, pitStopRaceFile, PIT_STOP_RACE_STATE_FULL_DEF } from '../../server/utils/pitStopRaceStore';
import { normalizeSurveysStoreState, surveysFile, SURVEYS_STATE_FULL_DEF } from '../../server/utils/surveysStore';
import {
  normalizeSurveyResponsesStoreState,
  surveyResponsesFile,
  SURVEY_RESPONSES_STATE_FULL_DEF
} from '../../server/utils/surveyResponsesStore';
import { surveyStartsFile } from '../../server/utils/surveyStartsStore';
import { surveyVisitsFile } from '../../server/utils/surveyVisitsStore';
import { adaptationStateFile, ADAPTATION_STATE_FULL_DEF } from '../../server/utils/adaptationStore';
import {
  adaptationAssignmentsFile,
  adaptationScenariosFile,
  ADAPTATION_SCENARIOS_STATE_FULL_DEF,
  normalizeScenariosState
} from '../../server/utils/adaptationScenarios';
import { normalizeVpnKeys, vpnKeysFile, VPN_KEYS_STATE_FULL_DEF } from '../../server/utils/vpnKeysStore';
import { applyEmployeesSeedToDb, mergeEmployeesSeed } from '../../server/core/seedSync';
import { createPgCoreRepo } from '../../server/db/repositories/core';

const ROOT = join(__dirname, '../../..');
const DATA_DIR = join(__dirname, '../../server/data');
const MERGE_CLI = join(ROOT, 'deploy/scripts/merge-employees-seed.mjs');

/** Как мутаторы сторов: нормализация до и после fn. */
function storeMutate<S>(repo: StateRepo, normalize: (raw: RawState) => S, fn: (s: S) => S | void, ctx = {}) {
  return repo.mutate(async (raw) => {
    const cur = normalize(raw);
    const next = normalize((fn(cur) ?? cur) as unknown as RawState);
    return { next: next as unknown as RawState, result: next };
  }, ctx);
}

type Scenario = { name: string; file: StateFile; def: KeyedStateDef; norm: (raw: RawState) => unknown; steps: ((s: any) => void)[] };

const pair = { ...createPair({ id: 2684, name: 'Драго' }, { id: 2353, name: 'Музыка' }), id: 'pair-2684-2353' };

/** Сценарии правок каждого файла: то, что делают API (снимок нормализованного стора после шага). */
const SCENARIOS: Scenario[] = [
  {
    name: 'пит-стоп',
    file: pitStopFile,
    def: PIT_STOP_STATE_FULL_DEF,
    norm: (r) => normalizePitStopState(r as never),
    steps: [
      (s) => {
        s.pairs.push(structuredClone(pair));
        s.players.push({ ...emptyPlayer(2684, 'Драго'), pairId: pair.id, role: 'A' }, { ...emptyPlayer(2353, 'Музыка'), pairId: pair.id, role: 'B' });
      },
      (s) => {
        s.players[0].checkpoints = { 1: 'done' };
        s.pairs[0].blindX = 1.5;
        s.pairs[0].blindStartedAt = '2026-10-19T10:00:00.000Z';
        s.pairs[0].ignitionHeldBy = [2684];
      },
      (s) => {
        s.players[1].checkpoints = { 1: 'done', 5: 'pending_review' };
        s.players[1].coffeePhotoPath = 'pit-stop-coffee/2353.jpg';
      },
      (s) => {
        s.players[1].coffeeApproved = true;
        s.players[1].checkpoints[5] = 'done';
        s.finalizedAt = '2026-10-20T07:00:00.000Z';
      }
    ]
  },
  {
    name: 'гонка',
    file: pitStopRaceFile,
    def: PIT_STOP_RACE_STATE_FULL_DEF,
    norm: (r) => normalizeRaceState(r as never),
    steps: [
      (s) => {
        s.visits.push({ userId: 7, name: 'Пилот', at: '2026-10-19T10:00:00.000Z' });
        s.records.push({ userId: 7, name: 'Пилот', department: 'Digital', bestMs: 61234, color: 'violet', laps: 1, bestAt: '2026-10-19T10:01:00.000Z', updatedAt: '2026-10-19T10:01:00.000Z', history: [{ ms: 61234, at: '2026-10-19T10:01:00.000Z' }] });
      },
      (s) => {
        s.records[0].laps = 2;
        s.records[0].cheat = { status: 'flagged', score: 0.9, reasons: ['ровно'], at: '2026-10-19T10:02:00.000Z', bestMs: 61234, lapsWhenFlagged: 2 };
      },
      (s) => {
        s.winners = [{ userId: 7, rank: 1, name: 'Пилот', bestMs: 61234 }];
        s.finalizedAt = '2026-10-20T00:00:00.000Z';
      }
    ]
  },
  {
    name: 'опросы',
    file: surveysFile,
    def: SURVEYS_STATE_FULL_DEF,
    norm: (r) => normalizeSurveysStoreState(r as never),
    steps: [
      (s) => {
        s.surveys.push({ id: 'survey-1', slug: 'pulse', title: 'Пульс', status: 'draft', anonymous: true, questions: [{ id: 'q1', type: 'nps', text: 'Оцени', required: true }], createdByUserId: 578, createdByName: 'HR', createdAt: '2026-10-19', updatedAt: '2026-10-19' });
        s.nextSurveyId = 2;
      },
      (s) => {
        s.surveys[0].status = 'published';
        s.surveys[0].publishedAt = '2026-10-19T12:00:00.000Z';
      },
      (s) => {
        s.surveys.push({ ...structuredClone(s.surveys[0]), id: 'survey-2', slug: 'pulse-2', anonymous: false });
        s.nextSurveyId = 3;
      },
      (s) => {
        s.surveys = s.surveys.filter((x: { id: string }) => x.id !== 'survey-1');
      }
    ]
  },
  {
    name: 'ответы',
    file: surveyResponsesFile,
    def: SURVEY_RESPONSES_STATE_FULL_DEF,
    norm: (r) => normalizeSurveyResponsesStoreState(r as never),
    steps: [
      (s) => {
        s.responses['survey-1'] = [{ id: 'resp-1', surveyId: 'survey-1', submittedAt: '2026-10-19T12:00:00.000Z', answers: { q1: 9 } }];
      },
      (s) => {
        s.responses['survey-2'] = [{ id: 'resp-2', surveyId: 'survey-2', submittedAt: '2026-10-19T12:01:00.000Z', answers: { q1: ['a', 'b'] }, respondent: { userId: 5, name: 'Иван' } }];
      },
      // ответ в опрос, который в карте не последний (порядок карты и списков сохраняется)
      (s) => {
        s.responses['survey-1'].push({ id: 'resp-3', surveyId: 'survey-1', submittedAt: '2026-10-19T12:02:00.000Z', answers: { q1: null } });
      },
      (s) => {
        delete s.responses['survey-1'];
      }
    ]
  },
  {
    name: 'визиты',
    file: surveyVisitsFile,
    def: surveyVisitsFile.def,
    norm: (r) => surveyVisitsFile.def.normalize(r),
    steps: [
      (s) => {
        s.visited['survey-1'] = 1;
      },
      (s) => {
        s.visited['survey-1'] += 1;
        s.visited['survey-2'] = 1;
      }
    ]
  },
  {
    name: 'адаптация',
    file: adaptationStateFile,
    def: ADAPTATION_STATE_FULL_DEF,
    norm: (r) => r,
    steps: [
      (s) => {
        s.attempts.push({ id: 'att-1', employee_id: 12, employee_name: 'Новичок', platform_user_id: 3012, quiz_id: 'quiz-day1', phase: 'day_1', quiz_title: 'День 1', answers: [{ question_id: 'q1', value: 'a' }], score_percent: 66.67, passed: false, submitted_at: '2026-10-19T09:00:00.000Z', admin_seen: false });
        s.step_completions.push({ step_id: 'd1-laptop', employee_id: 12, completed_at: '2026-10-19T09:05:00.000Z', completed_by_user_id: 3012 });
      },
      (s) => {
        s.attempts[0].admin_seen = true;
        s.step_completions.push({ step_id: 'd1-badge', employee_id: 12, completed_at: '2026-10-19T09:06:00.000Z', completed_by_user_id: 578 });
      },
      (s) => {
        s.attempts = [];
        s.step_completions = s.step_completions.filter((c: { step_id: string }) => c.step_id !== 'd1-laptop');
      }
    ]
  },
  {
    name: 'сценарии',
    file: adaptationScenariosFile,
    def: ADAPTATION_SCENARIOS_STATE_FULL_DEF,
    norm: (r) => normalizeScenariosState(r),
    steps: [
      (s) => {
        s.scenarios.push({ id: 'qa-stage8', title: 'Продажи', short_title: 'Продажи', description: '', audience: 'Отдел продаж', extra_steps_by_phase: { day_1: [{ id: 'crm', title: 'CRM', due_day: 1, owner: 'manager' }] } });
      },
      (s) => {
        s.scenarios[s.scenarios.length - 1].title = 'Продажи 2';
      }
    ]
  },
  {
    name: 'назначения',
    file: adaptationAssignmentsFile,
    def: adaptationAssignmentsFile.def,
    norm: (r) => adaptationAssignmentsFile.def.normalize(r),
    steps: [
      (s) => {
        s.assignments.push({ employee_id: 12, employee_name: 'Новичок', scenario_id: 'sales', assigned_at: '2026-10-19T09:00:00.000Z', assigned_by_user_id: 578, assigned_by_name: 'HR' });
      },
      (s) => {
        s.assignments = [{ ...s.assignments[0], scenario_id: 'default', assigned_at: '2026-10-19T10:00:00.000Z' }];
      }
    ]
  },
  {
    name: 'VPN',
    file: vpnKeysFile,
    def: VPN_KEYS_STATE_FULL_DEF,
    norm: (r) => ({ keys: normalizeVpnKeys(r) }),
    steps: [
      (s) => {
        s.keys.push({ id: 'wg-1', kind: 'wireguard', userId: 2684, userEmail: 'a@vbi.kz', clientName: 'Drago_Belg_Ahost', createdAt: '2026-10-19T09:00:00.000Z' });
        s.keys.push({ id: 'awg-1', kind: 'amnezia', userId: 2684, userEmail: 'a@vbi.kz', clientName: 'Drago_Belg_Ahost', createdAt: '2026-10-19T09:01:00.000Z' });
      },
      (s) => {
        s.keys = s.keys.filter((k: { id: string }) => k.id !== 'wg-1');
      }
    ]
  }
];

async function runScenario(sc: Scenario, repo: StateRepo): Promise<string[]> {
  const snaps: string[] = [];
  for (const step of sc.steps) {
    await storeMutate(repo, sc.norm as (r: RawState) => any, step);
    snaps.push(JSON.stringify(sc.norm(await repo.read())));
  }
  return snaps;
}

describe('маппинг этапа 8 JSON ↔ строка (байт-в-байт)', () => {
  const roundtrip = (def: { toRow: (i: any, p: number) => any; fromRow: (r: any) => any }, item: unknown) =>
    JSON.stringify(def.fromRow(def.toRow(JSON.parse(JSON.stringify(item)), 0)));

  it('записи: порядок ключей, чужой тип и неизвестное: в extra', () => {
    const p = { ...pair, blindStartedAt: 'не время', foo: 1 };
    expect(roundtrip(PIT_STOP_PAIR_DEF, p)).toBe(JSON.stringify(p));
    const pl = { ...emptyPlayer(5, 'X'), checkpoints: { 1: 'done' }, rewardsGranted: true };
    expect(roundtrip(PIT_STOP_PLAYER_DEF, pl)).toBe(JSON.stringify(pl));
    const rec = { userId: 1, name: 'a', bestMs: 60000.5, laps: '2', history: [] };
    expect(roundtrip(PIT_STOP_RACE_RECORD_DEF, rec)).toBe(JSON.stringify(rec));
    const sv = { id: 'survey-1', title: 'T', description: '', questions: [], createdAt: '2026-10-19', publishedAt: '2026-10-19' };
    expect(roundtrip(SURVEY_DEF, sv)).toBe(JSON.stringify(sv));
    const at = { id: 'a1', employee_id: 1, answers: [], score_percent: 33.333333333333336, passed: true };
    expect(roundtrip(ADAPTATION_ATTEMPT_DEF, at)).toBe(JSON.stringify(at));
    const step = { step_id: 's', employee_id: 1, completed_at: '2026-10-19T09:00:00.000Z' };
    expect(roundtrip(ADAPTATION_STEP_DEF, step)).toBe(JSON.stringify(step));
    expect(ADAPTATION_STEP_DEF.toRow(step, 0)!.key).toBe('[1,"s"]');
    const k = { id: 'x', kind: 'wireguard', userId: 1, userEmail: 'e', clientName: 'c', createdAt: '2026-10-19T09:00:00.000Z' };
    expect(roundtrip(VPN_KEY_DEF, k)).toBe(JSON.stringify(k));
  });

  it('ответ опроса: ключ карты отдельно, респондент только если был в файле', () => {
    const anon = { surveyKey: 'survey-1', response: { id: 'r1', surveyId: 'survey-1', submittedAt: 'x', answers: { q: 1 } } };
    const row = SURVEY_RESPONSE_DEF.toRow(anon, 0)!;
    expect(row.respondent).toBeNull();
    expect(Object.keys(row).some((c) => /employee/i.test(c))).toBe(false);
    expect(JSON.stringify(SURVEY_RESPONSE_DEF.fromRow(row))).toBe(JSON.stringify(anon));
    // аудит ответа: без ответов и без респондента
    const a = SURVEY_RESPONSE_DEF.audit!({ kind: 'create', key: 'r1', after: { ...anon, response: { ...anon.response, respondent: { userId: 5, name: 'Иван' } } } }, 'x');
    expect(JSON.stringify(a)).not.toMatch(/answers|respondent|Иван/);
  });

  it('состояние: пустой список ответов или битая карта → extra как есть', () => {
    for (const raw of [{ responses: { 'survey-1': [] } }, { responses: { a: 'oops' } }, { responses: {} }, {}]) {
      const split = splitState(SURVEY_RESPONSES_STATE_FULL_DEF, raw);
      const lists = new Map<string, unknown[]>();
      for (const part of SURVEY_RESPONSES_STATE_FULL_DEF.parts) lists.set(part.prop, split.lists.get(part.prop) ?? []);
      expect(JSON.stringify(assembleState(SURVEY_RESPONSES_STATE_FULL_DEF, split.meta, lists))).toBe(JSON.stringify(raw));
    }
  });

  it('VPN: только метаданные, секретоподобное поле останавливает перенос (без значений в ошибке)', () => {
    expect(() => assertVpnMetadataOnly({ keys: [{ id: 'a', kind: 'wireguard', userId: 1, userEmail: 'e', clientName: 'c', createdAt: 'x' }] })).not.toThrow();
    let msg = '';
    try {
      assertVpnMetadataOnly({ keys: [{ id: 'a', privateKey: 'SECRET-VALUE', configuration: '[Interface]' }] });
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toMatch(/keys\[\]\.privateKey/);
    expect(msg).toMatch(/keys\[\]\.configuration/);
    expect(msg).not.toMatch(/SECRET-VALUE|Interface/);
  });
});

let tmp = '';
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'vbi-stage8-'));
});
afterAll(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

describe('JSON-бэкенд этапа 8', () => {
  it('каждый файл: сценарий, формат файла как у стора, ошибка fn ничего не пишет', async () => {
    for (const sc of SCENARIOS) {
      const file = join(tmp, `j-${sc.file.fileName}`);
      const repo = sc.file.jsonRepo(file);
      const snaps = await runScenario(sc, repo);
      expect(JSON.stringify(sc.norm(JSON.parse(await readFile(file, 'utf8'))))).toBe(snaps.at(-1));
      const before = await readFile(file, 'utf8');
      await expect(
        repo.mutate(async () => {
          throw new Error('стоп');
        })
      ).rejects.toThrow('стоп');
      expect(await readFile(file, 'utf8')).toBe(before);
    }
  });

  it('гонка: нет файла → пусто и файл не создаётся при чтении (как раньше)', async () => {
    const file = join(tmp, 'нет-race.json');
    expect(normalizeRaceState((await pitStopRaceFile.jsonRepo(file).read()) as never).records).toEqual([]);
    await expect(readFile(file, 'utf8')).rejects.toThrow();
  });
});

describe('сид сотрудников: серверное слияние = CLI деплоя', () => {
  it('mergeEmployeesSeed даёт ровно те же файлы, что merge-employees-seed.mjs', async () => {
    const seed = JSON.parse(await readFile(join(DATA_DIR, 'employees.json'), 'utf8')) as Record<string, unknown>[];
    const target = seed.slice(2).map((e, i) => (i % 4 === 0 ? { ...e, title: 'Правка на стенде', manager: '' } : e));
    target.push({ id: 990001, name: 'Только На Стенде', manager: 'Руководитель' });
    const overlay = { byId: { [String(seed[4]!.id)]: 'Из Оверлея' }, byName: {} };
    const denylist = { entries: [{ employee_id: seed[0]!.id }] };
    const t = join(tmp, 'emp.json');
    const m = join(tmp, 'mgr.json');
    const d = join(tmp, 'deny.json');
    const inc = join(tmp, 'inc.json');
    await writeFile(t, JSON.stringify(target));
    await writeFile(m, JSON.stringify(overlay));
    await writeFile(d, JSON.stringify(denylist));
    await writeFile(inc, JSON.stringify(seed));
    execFileSync(process.execPath, [MERGE_CLI, t, inc, m, d], { stdio: 'pipe' });
    const out = mergeEmployeesSeed(target, seed, overlay, denylist.entries);
    expect(`${JSON.stringify(out.employees, null, 2)}\n`).toBe(await readFile(t, 'utf8'));
    expect(`${JSON.stringify(out.overlay, null, 2)}\n`).toBe(await readFile(m, 'utf8'));
    expect(out.stats).toMatchObject({ skippedDenied: 1, serverOnly: 1, repoOnly: 1 });
  });
});

/**
 * Postgres-часть: только при TEST_DATABASE_URL (локально vbi_dev). В CI базы нет: пропускается.
 * Тест создаёт себе отдельную временную базу и удаляет её.
 */
const TEST_DB = String(process.env.TEST_DATABASE_URL || '').trim();
describe.skipIf(!TEST_DB)('Postgres', () => {
  const dbName = `vbi_stage8_test_${process.pid}_${Date.now()}`;
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
  const SCHEMAS = ['engagement', 'surveys', 'adaptation', 'vpn'];
  async function truncateAll() {
    const tables = await sql`select table_schema || '.' || table_name as t from information_schema.tables where table_schema in ${sql(SCHEMAS)}`;
    await sql.unsafe(`truncate ${tables.map((t) => t.t).join(', ')}, audit.audit_log`);
  }

  it('миграции: этапы 0–8 на месте, схемы этапа 8', async () => {
    const [row] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    expect(row!.n).toBeGreaterThanOrEqual(8);
    const tables = await sql`select table_schema || '.' || table_name as t from information_schema.tables where table_schema in ${sql(SCHEMAS)} order by 1`;
    expect(tables.map((t) => t.t)).toEqual([
      'adaptation.assignments',
      'adaptation.attempts',
      'adaptation.json_imports',
      'adaptation.scenarios',
      'adaptation.state',
      'adaptation.step_completions',
      'engagement.json_imports',
      'engagement.pit_stop_pairs',
      'engagement.pit_stop_players',
      'engagement.pit_stop_race_records',
      'engagement.pit_stop_race_visits',
      'engagement.pit_stop_race_winners',
      'engagement.state',
      'surveys.json_imports',
      'surveys.responses',
      'surveys.start_counts',
      'surveys.state',
      'surveys.surveys',
      'surveys.visit_counts',
      'vpn.json_imports',
      'vpn.keys',
      'vpn.state'
    ]);
    // анонимность: у ответов и счётчиков нет колонки сотрудника/времени визита
    const cols = await sql`select table_name, column_name from information_schema.columns where table_schema = 'surveys' and table_name in ('responses', 'start_counts', 'visit_counts')`;
    expect(cols.filter((c) => /employee|user_id|ip|session|updated_at/.test(c.column_name))).toEqual([]);
  });

  it('контракт: тот же сценарий на JSON и Postgres даёт байт-в-байт тот же ответ (все 9 файлов)', async () => {
    await truncateAll();
    for (const sc of SCENARIOS) {
      const jsonSnaps = await runScenario(sc, sc.file.jsonRepo(join(tmp, `c-${sc.file.fileName}`)));
      // как на стенде: сначала разовый импорт (нет файла → начальное состояние стора)
      await sc.file.importFromJson(db(), join(tmp, 'нет-файла.json'));
      const pgSnaps = await runScenario(sc, createPgStateRepo(db(), sc.def));
      expect(pgSnaps, sc.name).toEqual(jsonSnaps);
      // свежий репозиторий без кэша читает из базы то же самое
      expect(JSON.stringify(sc.norm(await createPgStateRepo(db(), sc.def, { cacheTtlMs: 0 }).read())), sc.name).toBe(jsonSnaps.at(-1));
    }
  });

  it('ответы опроса: публичная отправка без actor, аудит без ответов; визиты без аудита', async () => {
    await truncateAll();
    await surveyResponsesFile.importFromJson(db(), join(tmp, 'нет-файла.json'));
    await surveyVisitsFile.importFromJson(db(), join(tmp, 'нет-файла.json'));
    const responses = createPgStateRepo(db(), SURVEY_RESPONSES_STATE_FULL_DEF);
    const norm = (r: RawState) => normalizeSurveyResponsesStoreState(r as never);
    await storeMutate(responses, norm, (s) => {
      s.responses['survey-9'] = [{ id: 'resp-9', surveyId: 'survey-9', submittedAt: '2026-10-19T12:00:00.000Z', answers: { q1: 'секретный ответ' } }];
    }, { reason: 'surveys:public-submit' });
    const audit = await sql`select action, entity, actor_employee_id, before, after from audit.audit_log where entity = 'surveys.response'`;
    expect(audit.map((a) => [a.action, a.actor_employee_id])).toEqual([['create', null]]);
    expect(JSON.stringify(audit)).not.toMatch(/секретный|answers/);
    const [r] = await sql`select * from surveys.responses`;
    expect(r!.respondent).toBeNull();

    const visits = createPgStateRepo(db(), surveyVisitsFile.def);
    const vnorm = (x: RawState) => surveyVisitsFile.def.normalize(x) as { visited: Record<string, number> };
    for (let i = 0; i < 3; i += 1) {
      await storeMutate(visits, vnorm, (s) => {
        s.visited['survey-9'] = (s.visited['survey-9'] || 0) + 1;
      });
    }
    expect(vnorm(await visits.read()).visited).toEqual({ 'survey-9': 3 });
    const [n] = await sql`select count(*)::int as n from audit.audit_log where entity like 'surveys.visit%' and action <> 'import_json'`;
    expect(n!.n).toBe(0);
  });

  it('запись diff-ом и аудит кто/почему (пит-стоп)', async () => {
    await truncateAll();
    const repo = createPgStateRepo(db(), PIT_STOP_STATE_FULL_DEF);
    const norm = (r: RawState) => normalizePitStopState(r as never);
    await storeMutate(repo, norm, (s) => {
      s.players.push(emptyPlayer(1, 'A'), emptyPlayer(2, 'B'));
    }, { actorEmployeeId: 578, reason: 'pit-stop:join' });
    await sql`update engagement.pit_stop_players set updated_at = '2020-01-01T00:00:00Z'`;
    await storeMutate(repo, norm, (s) => {
      s.players[1]!.checkpoints = { 2: 'done' };
    }, { actorEmployeeId: 9100, reason: 'pit-stop:checkpoint-2' });
    const rows = await sql`select user_id, updated_at = '2020-01-01T00:00:00Z'::timestamptz as untouched from engagement.pit_stop_players order by position`;
    expect(rows.map((r) => [r.user_id, r.untouched])).toEqual([
      [1, true],
      [2, false]
    ]);
    const [last] = await sql`select actor_employee_id, before, after from audit.audit_log where entity = 'engagement.pit_stop_player' order by id desc limit 1`;
    expect(last!.actor_employee_id).toBe(9100);
    expect(last!.after).toEqual({ reason: 'pit-stop:checkpoint-2', checkpoints: { 2: 'done' } });
  });

  it('импорт реальных файлов из репозитория: байт-в-байт, повтор: already', async () => {
    await truncateAll();
    const files: StateFile[] = [
      pitStopFile,
      surveysFile,
      surveyResponsesFile,
      surveyStartsFile,
      surveyVisitsFile,
      adaptationStateFile,
      adaptationScenariosFile,
      adaptationAssignmentsFile
    ];
    for (const f of files) {
      const path = join(DATA_DIR, f.fileName);
      const raw = JSON.parse(await readFile(path, 'utf8'));
      const r = await f.importFromJson(db(), path);
      expect(r.status, f.fileName).toBe('imported');
      expect(JSON.stringify(await createPgStateRepo(db(), f.def).read()), f.fileName).toBe(JSON.stringify(raw));
      expect((await f.importFromJson(db(), path)).status).toBe('already');
    }
    // сценарии адаптации в репозитории непустые: проверяем поле-в-поле в таблице
    const scen = JSON.parse(await readFile(join(DATA_DIR, 'adaptation-scenarios.json'), 'utf8'));
    const [c] = await sql`select count(*)::int as n from adaptation.scenarios`;
    expect(c!.n).toBe(scen.scenarios.length);
    // нет файла (гонка, VPN в git нет) → пустое состояние
    expect(await pitStopRaceFile.importFromJson(db(), join(tmp, 'нет.json'))).toMatchObject({ status: 'imported', fileCount: 0 });
    expect(await vpnKeysFile.importFromJson(db(), join(tmp, 'нет.json'))).toMatchObject({ status: 'imported', fileCount: 0 });
  });

  it('VPN: файл с секретом не импортируется (домен остаётся на файле)', async () => {
    await sql`truncate vpn.keys, vpn.state, vpn.json_imports`;
    const f = join(tmp, 'vpn-secret.json');
    await writeFile(f, JSON.stringify({ keys: [{ id: 'a', kind: 'wireguard', userId: 1, userEmail: 'e', clientName: 'c', createdAt: '2026-10-19T09:00:00.000Z', privateKey: 'x' }] }));
    await expect(vpnKeysFile.importFromJson(db(), f)).rejects.toThrow(/privateKey/);
    const [n] = await sql`select count(*)::int as n from vpn.keys`;
    expect(n!.n).toBe(0);
  });

  it('сид сотрудников в базе = CLI на файлах; раз на версию сида', async () => {
    await sql`truncate core.employees, core.employee_assignment_history, core.manager_assignments, core.manager_assignments_by_name, core.json_imports cascade`;
    const seed = JSON.parse(await readFile(join(DATA_DIR, 'employees.json'), 'utf8')) as Record<string, unknown>[];
    const core = createPgCoreRepo(db(), { cacheTtlMs: 0 });
    const target = seed.slice(1).map((e, i) => (i % 3 === 0 ? { ...e, title: 'Правка на стенде' } : e));
    await core.writeEmployeesRaw(target as never);
    await core.writeManagerAssignmentsRaw({ byId: { [String(seed[3]!.id)]: 'Из Оверлея' }, byName: {} });
    const denylist = [{ employee_id: seed[2]!.id as number, revoked_at: '2026-10-01T00:00:00.000Z' }];

    const beforeEmployees = await core.readEmployeesRaw();
    const beforeManagers = await core.readManagerAssignmentsRaw();
    const r = await applyEmployeesSeedToDb(db(), core, async () => denylist, seed);
    expect(r).toMatchObject({ status: 'applied', employeesChanged: true });

    // тот же результат, что CLI деплоя на файлах с тем же состоянием стенда
    const t = join(tmp, 'seed-emp.json');
    const m = join(tmp, 'seed-mgr.json');
    const d = join(tmp, 'seed-deny.json');
    const inc = join(tmp, 'seed-inc.json');
    await writeFile(t, JSON.stringify(beforeEmployees));
    await writeFile(m, JSON.stringify(beforeManagers));
    await writeFile(d, JSON.stringify({ entries: denylist }));
    await writeFile(inc, JSON.stringify(seed));
    execFileSync(process.execPath, [MERGE_CLI, t, inc, m, d], { stdio: 'pipe' });
    expect(JSON.stringify(await core.readEmployeesRaw())).toBe(JSON.stringify(JSON.parse(await readFile(t, 'utf8'))));
    const cliManagers = JSON.parse(await readFile(m, 'utf8'));
    const dbManagers = await core.readManagerAssignmentsRaw();
    expect(dbManagers.byId).toEqual(cliManagers.byId);
    expect(dbManagers.byName).toEqual(cliManagers.byName);

    // повтор того же сида: ничего; удалённый сотрудник не воскресает
    const after = await core.readEmployeesRaw();
    await core.writeEmployeesRaw(after.filter((e) => e.id !== seed[1]!.id));
    expect((await applyEmployeesSeedToDb(db(), core, async () => denylist, seed)).status).toBe('already');
    expect((await core.readEmployeesRaw()).some((e) => e.id === seed[1]!.id)).toBe(false);
    const [a] = await sql`select count(*)::int as n from audit.audit_log where after->>'reason' = 'deploy-seed-merge'`;
    expect(a!.n).toBeGreaterThan(0);
  });
});
