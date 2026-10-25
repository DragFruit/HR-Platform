import type { Survey, SurveyQuestion, SurveyQuestionType, SurveyStatus } from '../../app/composables/useSurveys';
import {
  SURVEY_QUESTION_TYPES,
  SMILEY_LABELS,
  SMILEY_POINT_COUNTS,
  NPS_DEFAULT_LOW_LABEL,
  NPS_DEFAULT_HIGH_LABEL,
  slugify
} from '../../app/composables/useSurveys';
import type { KeyedListWriteContext } from '../db/repositories/keyedList';
import type { KeyedStateDef, RawState } from '../db/repositories/keyedState';
import { defineStateFile } from '../db/repositories/stateFile';
import { surveysJsonImports } from '../db/schema';
import { SURVEYS_STATE_DEF, surveysDbFlag } from '../surveys/domain';

export type SurveysStoreState = {
  surveys: Survey[];
  nextSurveyId: number;
};

export const defaultSurveysState = (): SurveysStoreState => ({
  surveys: [],
  nextSurveyId: 1
});

function normalizeQuestion(raw: unknown): SurveyQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<SurveyQuestion>;
  if (typeof r.id !== 'string' || !r.id.trim()) return null;
  if (typeof r.type !== 'string' || !SURVEY_QUESTION_TYPES.includes(r.type as SurveyQuestionType)) {
    return null;
  }
  const type = r.type as SurveyQuestionType;
  const q: SurveyQuestion = {
    id: r.id.trim(),
    type,
    text: String(r.text || '').trim(),
    required: type === 'info' ? false : Boolean(r.required)
  };
  if (type === 'single' || type === 'multi') {
    const options = Array.isArray(r.options)
      ? r.options.map((o) => String(o || '').trim()).filter(Boolean)
      : [];
    q.options = options.length ? options : ['Вариант 1', 'Вариант 2'];
  }
  if (type === 'scale') {
    const min = Number(r.scaleMin);
    const max = Number(r.scaleMax);
    q.scaleMin = Number.isFinite(min) ? min : 1;
    q.scaleMax = Number.isFinite(max) && max > (q.scaleMin ?? 1) ? max : 10;
  }
  if (type === 'smiley') {
    const labels = Array.isArray(r.smileyLabels)
      ? r.smileyLabels.map((l) => String(l || '').trim()).filter(Boolean)
      : [];
    const count = SMILEY_POINT_COUNTS.includes(labels.length as 3 | 5) ? labels.length : SMILEY_LABELS.length;
    q.smileyLabels = labels.length === count ? labels : [...SMILEY_LABELS];
  }
  if (type === 'nps') {
    q.npsLowLabel = String(r.npsLowLabel || '').trim() || NPS_DEFAULT_LOW_LABEL;
    q.npsHighLabel = String(r.npsHighLabel || '').trim() || NPS_DEFAULT_HIGH_LABEL;
  }
  return q;
}

function normalizeSurvey(raw: unknown): Survey | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Survey>;
  if (typeof r.id !== 'string' || !r.id.trim()) return null;
  const status: SurveyStatus =
    r.status === 'published' || r.status === 'closed' ? r.status : 'draft';
  const questions = Array.isArray(r.questions)
    ? r.questions.map(normalizeQuestion).filter((q): q is SurveyQuestion => Boolean(q))
    : [];
  const createdByUserId = Number(r.createdByUserId);
  return {
    id: r.id.trim(),
    slug: String(r.slug || '').trim() || slugify(String(r.title || r.id)),
    title: String(r.title || '').trim() || 'Без названия',
    ...(r.description ? { description: String(r.description) } : {}),
    status,
    anonymous: Boolean(r.anonymous),
    questions,
    createdByUserId: Number.isFinite(createdByUserId) ? createdByUserId : 0,
    createdByName: String(r.createdByName || '').trim() || 'Админ',
    createdAt: String(r.createdAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    updatedAt: String(r.updatedAt || r.createdAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    ...(r.publishedAt ? { publishedAt: String(r.publishedAt) } : {})
  };
}

export function normalizeSurveysStoreState(raw: Partial<SurveysStoreState>): SurveysStoreState {
  const base = defaultSurveysState();
  const surveys = Array.isArray(raw.surveys)
    ? raw.surveys.map(normalizeSurvey).filter((s): s is Survey => Boolean(s))
    : [];
  return {
    surveys,
    nextSurveyId:
      typeof raw.nextSurveyId === 'number' && raw.nextSurveyId >= 1 ? raw.nextSurveyId : base.nextSurveyId
  };
}

export const SURVEYS_STATE_FULL_DEF: KeyedStateDef = {
  ...SURVEYS_STATE_DEF,
  normalize: (raw) => normalizeSurveysStoreState(raw as Partial<SurveysStoreState>)
};

/**
 * Этап 8: DB_SURVEYS=1 и задан DATABASE_URL → Postgres (схема surveys), иначе server/data/surveys.json.
 * Флаг стоит только на стейдже. Публичный API не менялся. Чтение — из кэша процесса (публичные
 * /api/public/surveys/* читают опрос на каждый запрос).
 */
export const surveysFile = defineStateFile({
  fileName: 'surveys.json',
  label: 'опросы',
  logTag: 'surveys',
  flag: surveysDbFlag,
  def: SURVEYS_STATE_FULL_DEF,
  jsonImports: surveysJsonImports,
  defaultRaw: () => defaultSurveysState() as unknown as RawState
});

export async function readSurveys(): Promise<SurveysStoreState> {
  return normalizeSurveysStoreState((await (await surveysFile.repo()).read()) as Partial<SurveysStoreState>);
}

export async function writeSurveys(state: SurveysStoreState, ctx: KeyedListWriteContext = {}): Promise<SurveysStoreState> {
  return mutateSurveys(() => state, ctx);
}

/** Правки опросов строго по очереди (в Postgres ещё транзакция под advisory lock). ctx — кто и почему. */
export async function mutateSurveys(
  mutator: (state: SurveysStoreState) => SurveysStoreState | Promise<SurveysStoreState>,
  ctx: KeyedListWriteContext = {}
): Promise<SurveysStoreState> {
  return (await surveysFile.repo()).mutate(async (raw) => {
    const current = normalizeSurveysStoreState(raw as Partial<SurveysStoreState>);
    const next = normalizeSurveysStoreState(await mutator(current));
    return { next: next as unknown as RawState, result: next };
  }, ctx);
}

export function uniqueSlug(state: SurveysStoreState, base: string, excludeId?: string): string {
  const taken = new Set(
    state.surveys.filter((s) => s.id !== excludeId).map((s) => s.slug)
  );
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}
