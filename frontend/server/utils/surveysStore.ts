import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeJsonAtomic } from './atomicJson';
import type { Survey, SurveyQuestion, SurveyQuestionType, SurveyStatus } from '../../app/composables/useSurveys';
import {
  SURVEY_QUESTION_TYPES,
  SMILEY_LABELS,
  SMILEY_POINT_COUNTS,
  NPS_DEFAULT_LOW_LABEL,
  NPS_DEFAULT_HIGH_LABEL,
  slugify
} from '../../app/composables/useSurveys';

export type SurveysStoreState = {
  surveys: Survey[];
  nextSurveyId: number;
};

const DATA_FILE = join(process.cwd(), 'server/data/surveys.json');

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

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeJsonAtomic(DATA_FILE, defaultSurveysState());
  }
}

export async function readSurveys(): Promise<SurveysStoreState> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  return normalizeSurveysStoreState(JSON.parse(raw) as Partial<SurveysStoreState>);
}

export async function writeSurveys(state: SurveysStoreState): Promise<SurveysStoreState> {
  await ensureFile();
  const normalized = normalizeSurveysStoreState(state);
  await writeJsonAtomic(DATA_FILE, normalized);
  return normalized;
}

let mutationQueue: Promise<unknown> = Promise.resolve();

export async function mutateSurveys(
  mutator: (state: SurveysStoreState) => SurveysStoreState | Promise<SurveysStoreState>
): Promise<SurveysStoreState> {
  const run = mutationQueue.then(async () => {
    const current = await readSurveys();
    const next = await mutator(current);
    return writeSurveys(next);
  });
  mutationQueue = run.catch(() => {});
  return run;
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
