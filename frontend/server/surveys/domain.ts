import { surveyResponses, surveyStartCounts, surveyVisitCounts, surveys, surveysState } from '../db/schema';
import { isBool, isInt, isoTimestamp, isStr, mapFromColumns, mapToColumns, nullColumns, type FieldSpecs } from '../db/fieldMapping';
import type { KeyedListDef } from '../db/repositories/keyedList';
import { arrayPart, isPlainObject, type KeyedStateDef, type StatePart } from '../db/repositories/keyedState';
import { dbFlag, flatListDef, mapPart } from '../db/repositories/stateFile';

/**
 * Этап 8: опросы (surveys.json, survey-responses.json, survey-starts.json, survey-visits.json) →
 * схема surveys. Маппинг «объект ↔ строка» (source_keys + extra). Нормализация: в сторах.
 *
 * Анонимность не меняется: в ответах ровно то, что было в файле (respondent: только если он там
 * был), без колонки сотрудника. В аудите ответов: только id опроса, без ответов и респондента;
 * счётчики воронки в аудит не пишутся вовсе (иначе время записи аудита = время визита).
 */

/** DB_SURVEYS=1 и задан DATABASE_URL → Postgres. Флаг стоит только на стейдже. */
export const surveysDbFlag = dbFlag('DB_SURVEYS');

export const SURVEYS_LOCK_KEY = 72_461_023;
export const SURVEY_RESPONSES_LOCK_KEY = 72_461_024;
export const SURVEY_STARTS_LOCK_KEY = 72_461_025;
export const SURVEY_VISITS_LOCK_KEY = 72_461_026;

const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

const SURVEY_FIELDS: FieldSpecs = {
  slug: { col: 'slug', ok: isStr },
  title: { col: 'title', ok: isStr },
  description: { col: 'description', ok: isStr },
  status: { col: 'status', ok: isStr },
  anonymous: { col: 'anonymous', ok: isBool },
  questions: { col: 'questions', ok: isArr },
  createdByUserId: { col: 'createdByUserId', ok: isInt },
  createdByName: { col: 'createdByName', ok: isStr },
  createdAt: { col: 'createdAt', ok: isStr },
  updatedAt: { col: 'updatedAt', ok: isStr },
  publishedAt: isoTimestamp('publishedAt')
};

export const SURVEY_DEF = flatListDef({
  table: surveys,
  keyField: 'id',
  keyOk: (v) => typeof v === 'string' && v.length > 0,
  fields: SURVEY_FIELDS,
  lockKey: SURVEYS_LOCK_KEY,
  auditEntity: 'surveys.survey',
  logTag: 'surveys',
  // updatedAt: поле опроса (данные), служебной колонки нет
  touchUpdatedAt: false
});

export const SURVEYS_STATE_DEF: Omit<KeyedStateDef, 'normalize'> = {
  lockKey: SURVEYS_LOCK_KEY,
  logTag: 'surveys',
  auditEntity: 'surveys.state',
  metaTable: surveysState,
  metaId: 1,
  metaFields: { nextSurveyId: { col: 'nextSurveyId', ok: isInt } },
  parts: [arrayPart('surveys', SURVEY_DEF)]
};

// ---------- ответы ----------

const RESPONSE_FIELDS: FieldSpecs = {
  surveyId: { col: 'surveyId', ok: isStr },
  submittedAt: isoTimestamp('submittedAt'),
  answers: { col: 'answers', ok: isPlainObject },
  respondent: { col: 'respondent', ok: isPlainObject }
};

/** Ответ в карте файла: ключ карты (survey id) + сам ответ как в файле. */
export type SurveyResponseEntry = { surveyKey: string; response: Record<string, unknown> };

export const SURVEY_RESPONSE_DEF: KeyedListDef<SurveyResponseEntry> = {
  table: surveyResponses,
  keyProp: 'id',
  lockKey: SURVEY_RESPONSES_LOCK_KEY,
  auditEntity: 'surveys.response',
  logTag: 'survey-responses',
  touchUpdatedAt: false,
  toRow: (e, position) => {
    const r = e?.response;
    if (!isPlainObject(r) || typeof r.id !== 'string' || !r.id || typeof e.surveyKey !== 'string') return null;
    const { cols, sourceKeys, extra } = mapToColumns(r, RESPONSE_FIELDS, ['id']);
    return { ...nullColumns(RESPONSE_FIELDS), ...cols, id: r.id, surveyKey: e.surveyKey, position, sourceKeys, extra };
  },
  fromRow: (row) => ({
    surveyKey: row.surveyKey as string,
    response: mapFromColumns(row, RESPONSE_FIELDS, row.sourceKeys as string[] | null, row.extra as Record<string, unknown> | null, {
      id: row.id
    })
  }),
  // Без ответов и респондента: аудит не должен деанонимизировать и копировать ответы
  audit: (change, reason) => {
    const surveyKey =
      change.kind === 'delete' ? change.before.surveyKey : change.kind === 'create' ? change.after.surveyKey : change.after.surveyKey;
    if (change.kind === 'update') return null; // ответы не правятся; перенумерация позиций: не событие
    return {
      action: change.kind,
      before: change.kind === 'delete' ? { surveyId: surveyKey } : null,
      after: { reason, surveyId: surveyKey }
    };
  }
};

/**
 * responses: { "<survey id>": [ответ, …] } → строка на ответ. Пустой список или не массив
 * объектов → вся карта лежит в extra строки state как есть (ничего не теряем).
 */
export const surveyResponsesPart: StatePart = {
  prop: 'responses',
  def: SURVEY_RESPONSE_DEF,
  toItems: (v) => {
    if (!isPlainObject(v)) return null;
    const items: SurveyResponseEntry[] = [];
    for (const [surveyKey, list] of Object.entries(v)) {
      if (!Array.isArray(list) || !list.length || !list.every(isPlainObject)) return null;
      for (const response of list) items.push({ surveyKey, response: response as Record<string, unknown> });
    }
    return items;
  },
  fromItems: (items) => {
    const out: Record<string, unknown[]> = {};
    for (const e of items as SurveyResponseEntry[]) (out[e.surveyKey] ??= []).push(e.response);
    return out;
  }
};

export const SURVEY_RESPONSES_STATE_DEF: Omit<KeyedStateDef, 'normalize'> = {
  lockKey: SURVEY_RESPONSES_LOCK_KEY,
  logTag: 'survey-responses',
  auditEntity: 'surveys.responses_state',
  metaTable: surveysState,
  metaId: 2,
  metaFields: {},
  parts: [surveyResponsesPart]
};

// ---------- счётчики воронки ----------

type CounterEntry = { key: string; value: number };

const counterDef = (table: typeof surveyStartCounts | typeof surveyVisitCounts, lockKey: number, entity: string, logTag: string): KeyedListDef<CounterEntry> => ({
  table,
  keyProp: 'surveyId',
  lockKey,
  auditEntity: entity,
  logTag,
  touchUpdatedAt: false,
  toRow: (e, position) => (e && typeof e.key === 'string' && isInt(e.value) ? { surveyId: e.key, count: e.value, position } : null),
  fromRow: (r) => ({ key: r.surveyId as string, value: r.count as number }),
  // счётчик: только число; время записи аудита выдало бы время визита
  audit: () => null
});

export const SURVEY_STARTS_DEF = counterDef(surveyStartCounts, SURVEY_STARTS_LOCK_KEY, 'surveys.start_count', 'survey-starts');
export const SURVEY_VISITS_DEF = counterDef(surveyVisitCounts, SURVEY_VISITS_LOCK_KEY, 'surveys.visit_count', 'survey-visits');

/** survey-starts.json ({ started: {...} }) или survey-visits.json ({ visited: {...} }). */
export function surveyCounterStateDef(kind: 'starts' | 'visits'): Omit<KeyedStateDef, 'normalize'> {
  const starts = kind === 'starts';
  return {
    lockKey: starts ? SURVEY_STARTS_LOCK_KEY : SURVEY_VISITS_LOCK_KEY,
    logTag: starts ? 'survey-starts' : 'survey-visits',
    auditEntity: starts ? 'surveys.starts_state' : 'surveys.visits_state',
    metaTable: surveysState,
    metaId: starts ? 3 : 4,
    metaFields: {},
    parts: [mapPart({ prop: starts ? 'started' : 'visited', def: starts ? SURVEY_STARTS_DEF : SURVEY_VISITS_DEF, valueOk: isInt })]
  };
}
