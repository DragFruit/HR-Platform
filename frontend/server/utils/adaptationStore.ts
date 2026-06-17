import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
    await writeFile(DATA_FILE, JSON.stringify(emptyState(), null, 2), 'utf8');
  }
}

export async function readAdaptationState(): Promise<AdaptationStoreState> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw) as AdaptationStoreState;
}

async function writeAdaptationState(state: AdaptationStoreState) {
  await ensureFile();
  await writeFile(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
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
