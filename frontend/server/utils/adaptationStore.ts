import { readFile, mkdir } from 'node:fs/promises';
import { writeJsonAtomic } from './atomicJson';
import { dirname, join } from 'node:path';
import type { AdaptationAttempt, AdaptationStoreState, StepCompletion } from './adaptationTypes';

const DATA_FILE = join(process.cwd(), 'server/data/adaptation-state.json');

const emptyState = (): AdaptationStoreState => ({
  attempts: [],
  step_completions: []
});

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeJsonAtomic(DATA_FILE, emptyState());
  }
}

export async function readAdaptationState(): Promise<AdaptationStoreState> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw) as AdaptationStoreState;
}

async function writeAdaptationState(state: AdaptationStoreState) {
  await ensureFile();
  await writeJsonAtomic(DATA_FILE, state);
}

export async function addAttempt(attempt: AdaptationAttempt): Promise<AdaptationAttempt> {
  const state = await readAdaptationState();
  state.attempts.push(attempt);
  await writeAdaptationState(state);
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

export async function markAttemptSeen(id: string): Promise<AdaptationAttempt | null> {
  const state = await readAdaptationState();
  const attempt = state.attempts.find((a) => a.id === id);
  if (!attempt) return null;
  attempt.admin_seen = true;
  await writeAdaptationState(state);
  return attempt;
}

export async function addStepCompletion(completion: StepCompletion): Promise<StepCompletion> {
  const state = await readAdaptationState();
  const exists = state.step_completions.find(
    (c) => c.step_id === completion.step_id && c.employee_id === completion.employee_id
  );
  if (!exists) {
    state.step_completions.push(completion);
    await writeAdaptationState(state);
  }
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
export async function purgeAdaptationProgressForEmployee(ids: {
  employee_id?: number;
  platform_user_ids?: number[];
}): Promise<number> {
  const employeeId = ids.employee_id;
  const platformIds = new Set(
    (ids.platform_user_ids || []).filter((id) => Number.isFinite(id) && id > 0)
  );
  if (employeeId && employeeId > 0) platformIds.add(employeeId);

  const state = await readAdaptationState();
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

  const removed =
    beforeAttempts - state.attempts.length + (beforeSteps - state.step_completions.length);
  if (removed) await writeAdaptationState(state);
  return removed;
}
