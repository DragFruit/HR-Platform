import {
  adaptationAssignments,
  adaptationAttempts,
  adaptationScenarios,
  adaptationState,
  adaptationStepCompletions
} from '../db/schema';
import { isBool, isInt, isoTimestamp, isStr, mapFromColumns, mapToColumns, nullColumns, type FieldSpecs } from '../db/fieldMapping';
import type { KeyedListDef } from '../db/repositories/keyedList';
import { arrayPart, isPlainObject, type KeyedStateDef } from '../db/repositories/keyedState';
import { dbFlag, flatListDef } from '../db/repositories/stateFile';

/**
 * Этап 8: адаптация (adaptation-state.json, adaptation-scenarios.json, adaptation-assignments.json)
 * → схема adaptation. Маппинг «объект ↔ строка» (source_keys + extra). Логика: в сторах.
 * adaptation-track.json: статичный шаблон в репозитории, не сюда.
 */

/** DB_ADAPTATION=1 и задан DATABASE_URL → Postgres. Флаг стоит только на стейдже. */
export const adaptationDbFlag = dbFlag('DB_ADAPTATION');

export const ADAPTATION_STATE_LOCK_KEY = 72_461_027;
export const ADAPTATION_SCENARIOS_LOCK_KEY = 72_461_028;
export const ADAPTATION_ASSIGNMENTS_LOCK_KEY = 72_461_029;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const isNonEmptyStr = (v: unknown) => typeof v === 'string' && v.length > 0;

export const ADAPTATION_ATTEMPT_DEF = flatListDef({
  table: adaptationAttempts,
  keyField: 'id',
  keyOk: isNonEmptyStr,
  fields: {
    employee_id: { col: 'employeeId', ok: isInt },
    employee_name: { col: 'employeeName', ok: isStr },
    platform_user_id: { col: 'platformUserId', ok: isInt },
    quiz_id: { col: 'quizId', ok: isStr },
    phase: { col: 'phase', ok: isStr },
    quiz_title: { col: 'quizTitle', ok: isStr },
    answers: { col: 'answers', ok: isArr },
    score_percent: { col: 'scorePercent', ok: isNum },
    passed: { col: 'passed', ok: isBool },
    submitted_at: isoTimestamp('submittedAt'),
    admin_seen: { col: 'adminSeen', ok: isBool }
  },
  lockKey: ADAPTATION_STATE_LOCK_KEY,
  auditEntity: 'adaptation.attempt',
  logTag: 'adaptation',
  touchUpdatedAt: true
});

const STEP_FIELDS: FieldSpecs = {
  step_id: { col: 'stepId', ok: isStr },
  employee_id: { col: 'employeeId', ok: isInt },
  completed_at: isoTimestamp('completedAt'),
  completed_by_user_id: { col: 'completedByUserId', ok: isInt }
};

/** Ключ строки шага: в файле id нет, уникальна пара (employee_id, step_id): так дедупит стор. */
export const stepCompletionKey = (c: Record<string, unknown>) => JSON.stringify([c.employee_id, c.step_id]);

export const ADAPTATION_STEP_DEF: KeyedListDef<Record<string, unknown>> = {
  table: adaptationStepCompletions,
  keyProp: 'key',
  lockKey: ADAPTATION_STATE_LOCK_KEY,
  auditEntity: 'adaptation.step_completion',
  logTag: 'adaptation',
  touchUpdatedAt: true,
  toRow: (item, position) => {
    if (!isPlainObject(item) || typeof item.step_id !== 'string' || !isInt(item.employee_id)) return null;
    const { cols, sourceKeys, extra } = mapToColumns(item, STEP_FIELDS);
    return { ...nullColumns(STEP_FIELDS), ...cols, key: stepCompletionKey(item), position, sourceKeys, extra };
  },
  fromRow: (r) => mapFromColumns(r, STEP_FIELDS, r.sourceKeys as string[] | null, r.extra as Record<string, unknown> | null)
};

export const ADAPTATION_STATE_DEF: Omit<KeyedStateDef, 'normalize'> = {
  lockKey: ADAPTATION_STATE_LOCK_KEY,
  logTag: 'adaptation',
  auditEntity: 'adaptation.state',
  metaTable: adaptationState,
  metaId: 1,
  metaFields: {},
  parts: [arrayPart('attempts', ADAPTATION_ATTEMPT_DEF), arrayPart('step_completions', ADAPTATION_STEP_DEF)]
};

export const ADAPTATION_SCENARIO_DEF = flatListDef({
  table: adaptationScenarios,
  keyField: 'id',
  keyOk: isNonEmptyStr,
  fields: {
    title: { col: 'title', ok: isStr },
    short_title: { col: 'shortTitle', ok: isStr },
    description: { col: 'description', ok: isStr },
    audience: { col: 'audience', ok: isStr },
    extra_steps_by_phase: { col: 'extraStepsByPhase', ok: isPlainObject }
  },
  lockKey: ADAPTATION_SCENARIOS_LOCK_KEY,
  auditEntity: 'adaptation.scenario',
  logTag: 'adaptation-scenarios',
  touchUpdatedAt: true
});

export const ADAPTATION_SCENARIOS_STATE_DEF: Omit<KeyedStateDef, 'normalize'> = {
  lockKey: ADAPTATION_SCENARIOS_LOCK_KEY,
  logTag: 'adaptation-scenarios',
  auditEntity: 'adaptation.scenarios_state',
  metaTable: adaptationState,
  metaId: 2,
  metaFields: {},
  parts: [arrayPart('scenarios', ADAPTATION_SCENARIO_DEF)]
};

export const ADAPTATION_ASSIGNMENT_DEF = flatListDef({
  table: adaptationAssignments,
  keyField: 'employee_id',
  keyProp: 'employeeId',
  keyOk: isInt,
  fields: {
    employee_name: { col: 'employeeName', ok: isStr },
    scenario_id: { col: 'scenarioId', ok: isStr },
    assigned_at: isoTimestamp('assignedAt'),
    assigned_by_user_id: { col: 'assignedByUserId', ok: isInt },
    assigned_by_name: { col: 'assignedByName', ok: isStr }
  },
  lockKey: ADAPTATION_ASSIGNMENTS_LOCK_KEY,
  auditEntity: 'adaptation.assignment',
  logTag: 'adaptation-assignments',
  touchUpdatedAt: true
});

export const ADAPTATION_ASSIGNMENTS_STATE_DEF: Omit<KeyedStateDef, 'normalize'> = {
  lockKey: ADAPTATION_ASSIGNMENTS_LOCK_KEY,
  logTag: 'adaptation-assignments',
  auditEntity: 'adaptation.assignments_state',
  metaTable: adaptationState,
  metaId: 3,
  metaFields: {},
  parts: [arrayPart('assignments', ADAPTATION_ASSIGNMENT_DEF)]
};
