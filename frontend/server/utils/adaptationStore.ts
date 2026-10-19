import type { AdaptationAttempt, AdaptationStoreState, StepCompletion } from './adaptationTypes';
import type { KeyedListWriteContext } from '../db/repositories/keyedList';
import type { KeyedStateDef, RawState } from '../db/repositories/keyedState';
import { defineStateFile } from '../db/repositories/stateFile';
import { adaptationJsonImports } from '../db/schema';
import { ADAPTATION_STATE_DEF, adaptationDbFlag } from '../adaptation/domain';

const emptyState = (): AdaptationStoreState => ({
  attempts: [],
  step_completions: []
});

export const ADAPTATION_STATE_FULL_DEF: KeyedStateDef = {
  ...ADAPTATION_STATE_DEF,
  // стор читает файл как есть, без нормализации
  normalize: (raw) => raw
};

/**
 * Этап 8: DB_ADAPTATION=1 и задан DATABASE_URL → Postgres (схема adaptation), иначе
 * server/data/adaptation-state.json. Флаг стоит только на стейдже. Публичный API не менялся;
 * правки теперь строго по очереди (раньше read → write без очереди).
 */
export const adaptationStateFile = defineStateFile({
  fileName: 'adaptation-state.json',
  label: 'адаптация (попытки и шаги)',
  logTag: 'adaptation',
  flag: adaptationDbFlag,
  def: ADAPTATION_STATE_FULL_DEF,
  jsonImports: adaptationJsonImports,
  defaultRaw: () => emptyState() as unknown as RawState
});

export async function readAdaptationState(): Promise<AdaptationStoreState> {
  return (await (await adaptationStateFile.repo()).read()) as unknown as AdaptationStoreState;
}

async function mutateAdaptationState<R>(
  fn: (state: AdaptationStoreState) => R | Promise<R>,
  ctx: KeyedListWriteContext
): Promise<R> {
  return (await adaptationStateFile.repo()).mutate(async (raw) => {
    const state = raw as unknown as AdaptationStoreState;
    const result = await fn(state);
    return { next: state as unknown as RawState, result };
  }, ctx);
}

export async function addAttempt(attempt: AdaptationAttempt, ctx: KeyedListWriteContext = {}): Promise<AdaptationAttempt> {
  await mutateAdaptationState((state) => {
    state.attempts.push(attempt);
  }, { reason: 'adaptation:attempt', ...ctx });
  return attempt;
}

export async function listAttempts(filters?: {
  employee_id?: number;
  platform_user_id?: number;
  phase?: string;
  unseen?: boolean;
}): Promise<AdaptationAttempt[]> {
  const state = await readAdaptationState();
  let list = [...state.attempts].sort(
    (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
  );
  if (filters?.employee_id != null) {
    list = list.filter((a) => a.employee_id === filters.employee_id);
  }
  if (filters?.platform_user_id != null) {
    list = list.filter((a) => a.platform_user_id === filters.platform_user_id);
  }
  if (filters?.phase) {
    list = list.filter((a) => a.phase === filters.phase);
  }
  if (filters?.unseen) {
    list = list.filter((a) => !a.admin_seen);
  }
  return list;
}

export async function markAttemptSeen(id: string, ctx: KeyedListWriteContext = {}): Promise<AdaptationAttempt | null> {
  return mutateAdaptationState((state) => {
    const attempt = state.attempts.find((a) => a.id === id);
    if (!attempt) return null;
    attempt.admin_seen = true;
    return structuredClone(attempt);
  }, { reason: 'adaptation:attempt-seen', ...ctx });
}

export async function addStepCompletion(completion: StepCompletion, ctx: KeyedListWriteContext = {}): Promise<StepCompletion> {
  await mutateAdaptationState((state) => {
    const exists = state.step_completions.find(
      (c) => c.step_id === completion.step_id && c.employee_id === completion.employee_id
    );
    if (!exists) state.step_completions.push(completion);
  }, { reason: 'adaptation:step-complete', ...ctx });
  return completion;
}

export async function listStepCompletions(employeeId: number): Promise<StepCompletion[]> {
  const state = await readAdaptationState();
  return state.step_completions.filter((c) => c.employee_id === employeeId);
}

export async function countUnseenAttempts(): Promise<number> {
  const state = await readAdaptationState();
  return state.attempts.filter((a) => !a.admin_seen).length;
}

/** Удалить прогресс адаптации сотрудника (назначение снимается отдельно). */
export async function purgeAdaptationProgressForEmployee(
  ids: {
    employee_id?: number;
    platform_user_ids?: number[];
  },
  ctx: KeyedListWriteContext = {}
): Promise<number> {
  const employeeId = ids.employee_id;
  const platformIds = new Set(
    (ids.platform_user_ids || []).filter((id) => Number.isFinite(id) && id > 0)
  );
  if (employeeId && employeeId > 0) platformIds.add(employeeId);

  return mutateAdaptationState((state) => {
    const beforeAttempts = state.attempts.length;
    const beforeSteps = state.step_completions.length;

    state.attempts = state.attempts.filter((a) => {
      if (employeeId && a.employee_id === employeeId) return false;
      if (a.platform_user_id && platformIds.has(a.platform_user_id)) return false;
      if (platformIds.has(a.employee_id)) return false;
      return true;
    });
    state.step_completions = state.step_completions.filter((c) => {
      if (employeeId && c.employee_id === employeeId) return false;
      if (platformIds.has(c.employee_id)) return false;
      return true;
    });

    return beforeAttempts - state.attempts.length + (beforeSteps - state.step_completions.length);
  }, { reason: 'adaptation:purge-employee', ...ctx });
}
