import type {
  AdaptationPhaseId,
  AdaptationStepTemplate,
  AdaptationTrackTemplate,
  StepOwner
} from './adaptationTypes';
import scenariosSeed from '../data/adaptation-scenarios.json';
import type { KeyedListWriteContext } from '../db/repositories/keyedList';
import type { KeyedStateDef, RawState } from '../db/repositories/keyedState';
import { defineStateFile } from '../db/repositories/stateFile';
import { adaptationJsonImports } from '../db/schema';
import {
  ADAPTATION_ASSIGNMENTS_STATE_DEF,
  ADAPTATION_SCENARIOS_STATE_DEF,
  adaptationDbFlag
} from '../adaptation/domain';

export type AdaptationScenario = {
  id: string;
  title: string;
  short_title: string;
  description: string;
  audience: string;
  extra_steps_by_phase?: Partial<Record<AdaptationPhaseId | string, AdaptationStepTemplate[]>>;
};

export type AdaptationAssignment = {
  employee_id: number;
  employee_name: string;
  scenario_id: string;
  assigned_at: string;
  assigned_by_user_id: number;
  assigned_by_name: string;
};

type ScenariosState = {
  scenarios: AdaptationScenario[];
};

type AssignmentsState = {
  assignments: AdaptationAssignment[];
};

const PHASE_IDS: AdaptationPhaseId[] = [
  'pre_start',
  'day_1',
  'week_1',
  'month_1',
  'probation_90'
];

const OWNERS: StepOwner[] = ['employee', 'manager', 'buddy', 'hr'];

const emptyAssignments = (): AssignmentsState => ({ assignments: [] });

/** Копия: правки стора не должны менять сид, загруженный в память модуля. */
const seedScenarios = (): AdaptationScenario[] =>
  structuredClone((scenariosSeed as { scenarios: AdaptationScenario[] }).scenarios);

/** Как до этапа 8: пустой или битый список сценариев → сид из репозитория. */
export function normalizeScenariosState(raw: unknown): ScenariosState {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as Partial<ScenariosState>).scenarios)
    ? (raw as ScenariosState).scenarios
    : [];
  return { scenarios: list.length ? list : seedScenarios() };
}

export function normalizeAssignmentsState(raw: unknown): AssignmentsState {
  const list = raw && typeof raw === 'object' ? (raw as Partial<AssignmentsState>).assignments : null;
  return { assignments: Array.isArray(list) ? list : [] };
}

export const ADAPTATION_SCENARIOS_STATE_FULL_DEF: KeyedStateDef = {
  ...ADAPTATION_SCENARIOS_STATE_DEF,
  normalize: normalizeScenariosState
};

export const ADAPTATION_ASSIGNMENTS_STATE_FULL_DEF: KeyedStateDef = {
  ...ADAPTATION_ASSIGNMENTS_STATE_DEF,
  normalize: normalizeAssignmentsState
};

/**
 * Этап 8: DB_ADAPTATION=1 и задан DATABASE_URL → Postgres (adaptation.scenarios / assignments),
 * иначе server/data/adaptation-*.json. Флаг стоит только на стейдже. Публичный API не менялся.
 */
export const adaptationScenariosFile = defineStateFile({
  fileName: 'adaptation-scenarios.json',
  label: 'сценарии адаптации',
  logTag: 'adaptation-scenarios',
  flag: adaptationDbFlag,
  def: ADAPTATION_SCENARIOS_STATE_FULL_DEF,
  jsonImports: adaptationJsonImports,
  defaultRaw: () => ({ scenarios: seedScenarios() }) as unknown as RawState,
  onBadJson: () => ({ scenarios: seedScenarios() }) as unknown as RawState
});

export const adaptationAssignmentsFile = defineStateFile({
  fileName: 'adaptation-assignments.json',
  label: 'назначения адаптации',
  logTag: 'adaptation-assignments',
  flag: adaptationDbFlag,
  def: ADAPTATION_ASSIGNMENTS_STATE_FULL_DEF,
  jsonImports: adaptationJsonImports,
  defaultRaw: () => emptyAssignments() as unknown as RawState,
  onBadJson: () => emptyAssignments() as unknown as RawState
});

async function readScenariosState(): Promise<ScenariosState> {
  return normalizeScenariosState(await (await adaptationScenariosFile.repo()).read());
}

async function mutateScenarios<R>(fn: (state: ScenariosState) => R | Promise<R>, ctx: KeyedListWriteContext): Promise<R> {
  return (await adaptationScenariosFile.repo()).mutate(async (raw) => {
    const state = normalizeScenariosState(raw);
    const result = await fn(state);
    return { next: state as unknown as RawState, result };
  }, ctx);
}

async function readAssignmentsState(): Promise<AssignmentsState> {
  return normalizeAssignmentsState(await (await adaptationAssignmentsFile.repo()).read());
}

async function mutateAssignments<R>(fn: (state: AssignmentsState) => R | Promise<R>, ctx: KeyedListWriteContext): Promise<R> {
  return (await adaptationAssignmentsFile.repo()).mutate(async (raw) => {
    const state = normalizeAssignmentsState(raw);
    const result = await fn(state);
    return { next: state as unknown as RawState, result };
  }, ctx);
}

export function slugifyScenarioId(input: string): string {
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya'
  };
  const lower = input.trim().toLowerCase();
  let out = '';
  for (const ch of lower) {
    if (map[ch] !== undefined) out += map[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/\s|_|\./.test(ch)) out += '-';
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || `scenario-${Date.now()}`;
}

const sanitizeSteps = (
  steps: AdaptationStepTemplate[] | undefined,
  phaseId: string
): AdaptationStepTemplate[] => {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((step, index) => {
      const title = String(step?.title || '').trim();
      if (!title) return null;
      const owner = OWNERS.includes(step.owner as StepOwner)
        ? (step.owner as StepOwner)
        : 'employee';
      const due = Number(step.due_day);
      const idRaw = String(step.id || '').trim();
      const id =
        idRaw ||
        `${phaseId}_step_${index + 1}_${Date.now().toString(36)}`;
      return {
        id,
        title,
        due_day: Number.isFinite(due) ? due : 1,
        owner
      };
    })
    .filter(Boolean) as AdaptationStepTemplate[];
};

export function normalizeScenarioInput(
  input: Partial<AdaptationScenario> & { title?: string },
  options?: { id?: string; keepId?: string }
): AdaptationScenario {
  const title = String(input.title || '').trim();
  if (title.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Название — минимум 3 символа' });
  }

  const id =
    options?.keepId ||
    options?.id ||
    slugifyScenarioId(String(input.id || input.short_title || title));

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'id: только латиница, цифры и дефис'
    });
  }

  const short =
    String(input.short_title || '').trim() || title.split(/\s+/).slice(0, 2).join(' ');
  const description = String(input.description || '').trim();
  const audience = String(input.audience || '').trim() || 'Все';

  const extras: AdaptationScenario['extra_steps_by_phase'] = {};
  const rawExtras = input.extra_steps_by_phase || {};
  for (const phaseId of PHASE_IDS) {
    const steps = sanitizeSteps(rawExtras[phaseId], phaseId);
    if (steps.length) extras[phaseId] = steps;
  }

  return {
    id,
    title,
    short_title: short.slice(0, 40),
    description: description || title,
    audience,
    ...(Object.keys(extras).length ? { extra_steps_by_phase: extras } : {})
  };
}

export async function listAdaptationScenarios(): Promise<AdaptationScenario[]> {
  const state = await readScenariosState();
  return state.scenarios;
}

export async function findAdaptationScenario(id: string): Promise<AdaptationScenario | null> {
  const list = await listAdaptationScenarios();
  return list.find((s) => s.id === id) ?? null;
}

export function applyScenarioToTrack(
  track: AdaptationTrackTemplate,
  scenario: AdaptationScenario | null
): AdaptationTrackTemplate {
  if (!scenario) return track;

  const next = structuredClone(track);
  next.id = scenario.id;
  next.title = scenario.title;
  const extras = scenario.extra_steps_by_phase || {};
  for (const phase of next.phases) {
    const add = extras[phase.id];
    if (add?.length) {
      phase.steps = [...phase.steps, ...structuredClone(add)];
    }
  }
  return next;
}

export async function createAdaptationScenario(
  input: Partial<AdaptationScenario>,
  ctx: KeyedListWriteContext = {}
): Promise<AdaptationScenario> {
  const scenario = normalizeScenarioInput(input);
  await mutateScenarios((state) => {
    if (state.scenarios.some((s) => s.id === scenario.id)) {
      throw createError({ statusCode: 409, statusMessage: 'Сценарий с таким id уже есть' });
    }
    state.scenarios.push(scenario);
  }, { reason: 'adaptation:scenario-create', ...ctx });
  return scenario;
}

export async function updateAdaptationScenario(
  id: string,
  input: Partial<AdaptationScenario>,
  ctx: KeyedListWriteContext = {}
): Promise<AdaptationScenario> {
  return mutateScenarios((state) => {
    const index = state.scenarios.findIndex((s) => s.id === id);
    if (index === -1) {
      throw createError({ statusCode: 404, statusMessage: 'Сценарий не найден' });
    }
    const scenario = normalizeScenarioInput(input, { keepId: id });
    state.scenarios[index] = scenario;
    return structuredClone(scenario);
  }, { reason: 'adaptation:scenario-update', ...ctx });
}

export async function deleteAdaptationScenario(id: string, ctx: KeyedListWriteContext = {}): Promise<boolean> {
  const removed = await mutateScenarios((state) => {
    const next = state.scenarios.filter((s) => s.id !== id);
    if (next.length === state.scenarios.length) return false;
    if (!next.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Нельзя удалить последний сценарий'
      });
    }
    state.scenarios = next;
    return true;
  }, { reason: 'adaptation:scenario-delete', ...ctx });
  if (!removed) return false;

  await mutateAssignments((assignments) => {
    assignments.assignments = assignments.assignments.filter((row) => row.scenario_id !== id);
  }, { reason: 'adaptation:scenario-delete', ...ctx });
  return true;
}

export async function listAdaptationAssignments(): Promise<AdaptationAssignment[]> {
  const state = await readAssignmentsState();
  return [...state.assignments].sort(
    (a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime()
  );
}

export async function getAssignmentForEmployee(
  employeeId: number
): Promise<AdaptationAssignment | null> {
  const state = await readAssignmentsState();
  return state.assignments.find((row) => row.employee_id === employeeId) ?? null;
}

export async function removeAdaptationAssignmentForEmployee(
  employeeId: number,
  ctx: KeyedListWriteContext = {}
): Promise<boolean> {
  if (!Number.isFinite(employeeId) || employeeId <= 0) return false;
  return mutateAssignments((state) => {
    const next = state.assignments.filter((row) => row.employee_id !== employeeId);
    if (next.length === state.assignments.length) return false;
    state.assignments = next;
    return true;
  }, { reason: 'adaptation:unassign-employee', ...ctx });
}

export async function assignAdaptationScenario(input: {
  employee_id: number;
  employee_name: string;
  scenario_id: string;
  assigned_by_user_id: number;
  assigned_by_name: string;
}, ctx: KeyedListWriteContext = {}): Promise<AdaptationAssignment> {
  const scenario = await findAdaptationScenario(input.scenario_id);
  if (!scenario) {
    throw createError({ statusCode: 400, statusMessage: 'Неизвестный сценарий' });
  }

  const assignment: AdaptationAssignment = {
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    scenario_id: input.scenario_id,
    assigned_at: new Date().toISOString(),
    assigned_by_user_id: input.assigned_by_user_id,
    assigned_by_name: input.assigned_by_name
  };

  await mutateAssignments((state) => {
    const without = state.assignments.filter((row) => row.employee_id !== input.employee_id);
    without.push(assignment);
    state.assignments = without;
  }, { reason: 'adaptation:assign', ...ctx });
  return assignment;
}

export const ADAPTATION_PHASE_OPTIONS: { id: AdaptationPhaseId; label: string }[] = [
  { id: 'pre_start', label: 'До выхода' },
  { id: 'day_1', label: 'День 1' },
  { id: 'week_1', label: 'Неделя 1' },
  { id: 'month_1', label: '30 дней' },
  { id: 'probation_90', label: '90 дней' }
];

export const ADAPTATION_OWNER_OPTIONS: { id: StepOwner; label: string }[] = [
  { id: 'employee', label: 'Сотрудник' },
  { id: 'manager', label: 'Руководитель' },
  { id: 'buddy', label: 'Buddy' },
  { id: 'hr', label: 'HR' }
];
