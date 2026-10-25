import type { SurveyAnswerValue, SurveyResponse } from '../../app/composables/useSurveys';
import type { KeyedListWriteContext } from '../db/repositories/keyedList';
import type { KeyedStateDef, RawState } from '../db/repositories/keyedState';
import { defineStateFile } from '../db/repositories/stateFile';
import { surveysJsonImports } from '../db/schema';
import { SURVEY_RESPONSES_STATE_DEF, surveysDbFlag } from '../surveys/domain';

export type SurveyResponsesStoreState = {
  /** surveyId → список ответов. */
  responses: Record<string, SurveyResponse[]>;
};

export const defaultSurveyResponsesState = (): SurveyResponsesStoreState => ({ responses: {} });

function normalizeAnswerValue(raw: unknown): SurveyAnswerValue {
  if (raw === null) return null;
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw;
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  return null;
}

function normalizeResponse(raw: unknown): SurveyResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<SurveyResponse>;
  if (typeof r.id !== 'string' || !r.id.trim()) return null;
  if (typeof r.surveyId !== 'string' || !r.surveyId.trim()) return null;
  const answers: Record<string, SurveyAnswerValue> = {};
  if (r.answers && typeof r.answers === 'object') {
    for (const [qid, val] of Object.entries(r.answers)) {
      answers[qid] = normalizeAnswerValue(val);
    }
  }
  const response: SurveyResponse = {
    id: r.id.trim(),
    surveyId: r.surveyId.trim(),
    submittedAt: String(r.submittedAt || '') || new Date().toISOString(),
    answers
  };
  // Респондент переносится только если присутствуют оба поля — никогда частично.
  if (r.respondent && typeof r.respondent === 'object') {
    const userId = Number((r.respondent as { userId?: unknown }).userId);
    const name = String((r.respondent as { name?: unknown }).name || '').trim();
    if (Number.isFinite(userId) && userId > 0 && name) {
      response.respondent = { userId, name };
    }
  }
  return response;
}

export function normalizeSurveyResponsesStoreState(
  raw: Partial<SurveyResponsesStoreState>
): SurveyResponsesStoreState {
  const result: SurveyResponsesStoreState = { responses: {} };
  if (raw.responses && typeof raw.responses === 'object') {
    for (const [surveyId, list] of Object.entries(raw.responses)) {
      if (!Array.isArray(list)) continue;
      const cleaned = list.map(normalizeResponse).filter((r): r is SurveyResponse => Boolean(r));
      result.responses[surveyId] = cleaned;
    }
  }
  return result;
}

export const SURVEY_RESPONSES_STATE_FULL_DEF: KeyedStateDef = {
  ...SURVEY_RESPONSES_STATE_DEF,
  normalize: (raw) => normalizeSurveyResponsesStoreState(raw as Partial<SurveyResponsesStoreState>)
};

/**
 * Этап 8: DB_SURVEYS=1 → Postgres (surveys.responses), иначе server/data/survey-responses.json.
 * Анонимность прежняя: в базе ровно то, что было бы в файле, без связи с сотрудником.
 */
export const surveyResponsesFile = defineStateFile({
  fileName: 'survey-responses.json',
  label: 'ответы опросов',
  logTag: 'survey-responses',
  flag: surveysDbFlag,
  def: SURVEY_RESPONSES_STATE_FULL_DEF,
  jsonImports: surveysJsonImports,
  defaultRaw: () => defaultSurveyResponsesState() as unknown as RawState
});

export async function readSurveyResponses(): Promise<SurveyResponsesStoreState> {
  return normalizeSurveyResponsesStoreState((await (await surveyResponsesFile.repo()).read()) as Partial<SurveyResponsesStoreState>);
}

export async function writeSurveyResponses(
  state: SurveyResponsesStoreState,
  ctx: KeyedListWriteContext = {}
): Promise<SurveyResponsesStoreState> {
  return mutateSurveyResponses(() => state, ctx);
}

/** Публичная отправка ответа идёт без ctx: actor = null, как и раньше ничего о респонденте сверх файла. */
export async function mutateSurveyResponses(
  mutator: (state: SurveyResponsesStoreState) => SurveyResponsesStoreState | Promise<SurveyResponsesStoreState>,
  ctx: KeyedListWriteContext = {}
): Promise<SurveyResponsesStoreState> {
  return (await surveyResponsesFile.repo()).mutate(async (raw) => {
    const current = normalizeSurveyResponsesStoreState(raw as Partial<SurveyResponsesStoreState>);
    const next = normalizeSurveyResponsesStoreState(await mutator(current));
    return { next: next as unknown as RawState, result: next };
  }, ctx);
}

export function responsesForSurvey(
  state: SurveyResponsesStoreState,
  surveyId: string
): SurveyResponse[] {
  return state.responses[surveyId] ?? [];
}
