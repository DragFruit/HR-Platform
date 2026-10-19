import { boolean, doublePrecision, index, integer, json, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Схема `adaptation`: адаптация новичков (этап 8). Флаг DB_ADAPTATION=1 (сейчас только стейдж).
 * - adaptation-state.json → attempts, step_completions (state id=1);
 * - adaptation-scenarios.json → scenarios (state id=2);
 * - adaptation-assignments.json → assignments (state id=3).
 * Шаблон трека (adaptation-track.json): статичный сид в репозитории, остаётся файлом.
 * employee_id: как в файле (id справочника), без внешнего ключа: история адаптации не должна
 * пропадать или ломаться из-за правок справочника.
 */
export const adaptationSchema = pgSchema('adaptation');

const service = {
  sourceKeys: text('source_keys').array(),
  extra: json('extra').$type<Record<string, unknown>>()
};

/** Попытки квизов (adaptation-state.json → attempts[]). */
export const adaptationAttempts = adaptationSchema.table(
  'attempts',
  {
    id: text('id').primaryKey(),
    position: integer('position').notNull().default(0),
    employeeId: integer('employee_id'),
    employeeName: text('employee_name'),
    platformUserId: integer('platform_user_id'),
    quizId: text('quiz_id'),
    phase: text('phase'),
    quizTitle: text('quiz_title'),
    answers: json('answers').$type<unknown[]>(),
    scorePercent: doublePrecision('score_percent'),
    passed: boolean('passed'),
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }),
    adminSeen: boolean('admin_seen'),
    ...service,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('adaptation_attempts_employee_idx').on(t.employeeId)]
);

/**
 * Отмеченные шаги (adaptation-state.json → step_completions[]). В файле нет id: ключ строки
 * собран из пары (employee_id, step_id), сам ключ в ответ API не попадает.
 */
export const adaptationStepCompletions = adaptationSchema.table(
  'step_completions',
  {
    key: text('key').primaryKey(),
    position: integer('position').notNull().default(0),
    stepId: text('step_id'),
    employeeId: integer('employee_id'),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    completedByUserId: integer('completed_by_user_id'),
    ...service,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('adaptation_steps_employee_idx').on(t.employeeId)]
);

/** Сценарии адаптации (adaptation-scenarios.json → scenarios[]). */
export const adaptationScenarios = adaptationSchema.table('scenarios', {
  id: text('id').primaryKey(),
  position: integer('position').notNull().default(0),
  title: text('title'),
  shortTitle: text('short_title'),
  description: text('description'),
  audience: text('audience'),
  extraStepsByPhase: json('extra_steps_by_phase').$type<Record<string, unknown>>(),
  ...service,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Назначения сценария сотруднику (adaptation-assignments.json → assignments[]), одно на сотрудника. */
export const adaptationAssignments = adaptationSchema.table('assignments', {
  employeeId: integer('employee_id').primaryKey(),
  position: integer('position').notNull().default(0),
  employeeName: text('employee_name'),
  scenarioId: text('scenario_id'),
  assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'date' }),
  assignedByUserId: integer('assigned_by_user_id'),
  assignedByName: text('assigned_by_name'),
  ...service,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Остальное содержимое файлов (порядок ключей, неизвестные ключи). id: 1 state, 2 scenarios, 3 assignments. */
export const adaptationState = adaptationSchema.table('state', {
  id: integer('id').primaryKey(),
  ...service,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Разовые импорты из JSON: строка есть → импорт уже был, повторно не запускаем. */
export const adaptationJsonImports = adaptationSchema.table('json_imports', {
  source: text('source').primaryKey(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  fileCount: integer('file_count').notNull(),
  inserted: integer('inserted').notNull(),
  skipped: integer('skipped').notNull()
});
