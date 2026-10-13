import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeJsonAtomic } from './atomicJson';
import type { SurveyAnswerValue, SurveyResponse } from '../../app/composables/useSurveys';

export type SurveyResponsesStoreState = {
  /** surveyId → список ответов. */
  responses: Record<string, SurveyResponse[]>;
};

const DATA_FILE = join(process.cwd(), 'server/data/survey-responses.json');

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

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeJsonAtomic(DATA_FILE, defaultSurveyResponsesState());
  }
}

export async function readSurveyResponses(): Promise<SurveyResponsesStoreState> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  return normalizeSurveyResponsesStoreState(JSON.parse(raw) as Partial<SurveyResponsesStoreState>);
}

export async function writeSurveyResponses(
  state: SurveyResponsesStoreState
): Promise<SurveyResponsesStoreState> {
  await ensureFile();
  const normalized = normalizeSurveyResponsesStoreState(state);
  await writeJsonAtomic(DATA_FILE, normalized);
  return normalized;
}

let mutationQueue: Promise<unknown> = Promise.resolve();

export async function mutateSurveyResponses(
  mutator: (state: SurveyResponsesStoreState) => SurveyResponsesStoreState | Promise<SurveyResponsesStoreState>
): Promise<SurveyResponsesStoreState> {
  const run = mutationQueue.then(async () => {
    const current = await readSurveyResponses();
    const next = await mutator(current);
    return writeSurveyResponses(next);
  });
  mutationQueue = run.catch(() => {});
  return run;
}

export function responsesForSurvey(
  state: SurveyResponsesStoreState,
  surveyId: string
): SurveyResponse[] {
  return state.responses[surveyId] ?? [];
}
