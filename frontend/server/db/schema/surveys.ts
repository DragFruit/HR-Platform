import { boolean, index, integer, json, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Схема `surveys`: опросы (этап 8). Флаг DB_SURVEYS=1 (сейчас только стейдж).
 * - surveys.json → surveys (+ nextSurveyId в state id=1);
 * - survey-responses.json → responses (state id=2);
 * - survey-starts.json → start_counts (state id=3), survey-visits.json → visit_counts (state id=4).
 *
 * Анонимность как в файлах: у ответа нет колонки сотрудника и нет связи с core.employees.
 * respondent ({userId, name}) лежит JSON-ом только там, где он есть в файле (неанонимный опрос
 * и залогиненный респондент). Счётчики воронки: только число на опрос, без времени и личности.
 */
export const surveysSchema = pgSchema('surveys');

const service = {
  sourceKeys: text('source_keys').array(),
  extra: json('extra').$type<Record<string, unknown>>()
};

/** Опросы (surveys.json → surveys[]). updatedAt: поле опроса, служебной колонки нет. */
export const surveys = surveysSchema.table(
  'surveys',
  {
    id: text('id').primaryKey(),
    position: integer('position').notNull().default(0),
    slug: text('slug'),
    title: text('title'),
    description: text('description'),
    /** draft | published | closed. */
    status: text('status'),
    anonymous: boolean('anonymous'),
    questions: json('questions').$type<unknown[]>(),
    createdByUserId: integer('created_by_user_id'),
    createdByName: text('created_by_name'),
    /** YYYY-MM-DD строкой, как в файле. */
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    ...service
  },
  (t) => [index('surveys_slug_idx').on(t.slug)]
);

/**
 * Ответы (survey-responses.json → responses: { "<survey id>": [ответ, …] }), строка на ответ.
 * survey_key: ключ карты в файле (по нему ответы собираются обратно в том же порядке).
 */
export const surveyResponses = surveysSchema.table(
  'responses',
  {
    id: text('id').primaryKey(),
    position: integer('position').notNull().default(0),
    surveyKey: text('survey_key').notNull(),
    surveyId: text('survey_id'),
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }),
    answers: json('answers').$type<Record<string, unknown>>(),
    /** Только если есть в файле (неанонимный опрос). Не FK и не employee_id. */
    respondent: json('respondent').$type<Record<string, unknown>>(),
    ...service
  },
  (t) => [index('survey_responses_survey_idx').on(t.surveyKey)]
);

/** «Начали отвечать»: число на опрос (survey-starts.json → started). */
export const surveyStartCounts = surveysSchema.table('start_counts', {
  surveyId: text('survey_id').primaryKey(),
  position: integer('position').notNull().default(0),
  count: integer('count').notNull()
});

/** Визиты страницы опроса: число на опрос (survey-visits.json → visited). */
export const surveyVisitCounts = surveysSchema.table('visit_counts', {
  surveyId: text('survey_id').primaryKey(),
  position: integer('position').notNull().default(0),
  count: integer('count').notNull()
});

/** Остальное содержимое файлов (порядок ключей, nextSurveyId). id: 1 surveys, 2 responses, 3 starts, 4 visits. */
export const surveysState = surveysSchema.table('state', {
  id: integer('id').primaryKey(),
  nextSurveyId: integer('next_survey_id'),
  ...service,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Разовые импорты из JSON: строка есть → импорт уже был, повторно не запускаем. */
export const surveysJsonImports = surveysSchema.table('json_imports', {
  source: text('source').primaryKey(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  fileCount: integer('file_count').notNull(),
  inserted: integer('inserted').notNull(),
  skipped: integer('skipped').notNull()
});
