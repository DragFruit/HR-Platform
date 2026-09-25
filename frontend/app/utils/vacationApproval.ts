import {
  QA_DIRECTOR_NAME,
  QA_TEAM_LEAD_NAME,
  QA_TEST_DEPARTMENT_NAME
} from '~/data/qaTestDepartment';
import { employeeNamesMatch } from '~/utils/employeeName';

export type VacationApprovalStep = 'manager' | 'director';

export const DIGITAL_DIRECTOR_NAME = 'Ревзина Ксения';

const DIGITAL_GROUP_LEAD_SURNAMES = new Set(['Попов', 'Лунин', 'Цхай', 'Носков']);

export type VacationEmployeeRef = {
  id?: number;
  department: string;
  manager: string;
  manager_id?: number | null;
};

export type VacationApproverRef = {
  id?: number | null;
  name: string;
};

type TwoStepDepartmentConfig = {
  department: string;
  directorName: string;
  directorStepLabel: string;
  isGroupLeadManager: (managerName: string) => boolean;
};

const TWO_STEP_DEPARTMENTS: TwoStepDepartmentConfig[] = [
  {
    department: 'Digital',
    directorName: DIGITAL_DIRECTOR_NAME,
    directorStepLabel: 'На согласовании у Digital Director',
    isGroupLeadManager: (managerName) => {
      const surname = managerName.trim().split(/\s+/)[0] ?? '';
      return DIGITAL_GROUP_LEAD_SURNAMES.has(surname);
    }
  },
  {
    department: QA_TEST_DEPARTMENT_NAME,
    directorName: QA_DIRECTOR_NAME,
    directorStepLabel: 'На согласовании у директора отдела',
    isGroupLeadManager: (managerName) =>
      employeeNamesMatch(managerName, QA_TEAM_LEAD_NAME)
  }
];

function getTwoStepConfig(department: string): TwoStepDepartmentConfig | undefined {
  return TWO_STEP_DEPARTMENTS.find((cfg) => cfg.department === department.trim());
}

const asApprover = (approver: string | VacationApproverRef): VacationApproverRef =>
  typeof approver === 'string' ? { name: approver } : approver;

const samePerson = (
  left: { id?: number | null; name?: string | null },
  rightName: string,
  rightId?: number | null
): boolean => {
  const leftId = Number(left.id);
  const right = Number(rightId);
  if (Number.isFinite(leftId) && leftId > 0 && Number.isFinite(right) && right > 0) {
    return leftId === right;
  }
  const leftName = String(left.name || '').trim();
  return Boolean(leftName && rightName && employeeNamesMatch(leftName, rightName));
};

/** Директор отдела при двухэтапном согласовании (Digital, QA-тест и т.д.). */
export function resolveDepartmentDirectorName(employee: VacationEmployeeRef): string | null {
  const cfg = getTwoStepConfig(employee.department);
  return cfg?.directorName ?? null;
}

export function isDigitalDepartment(department: string): boolean {
  return department.trim() === 'Digital';
}

export function isDigitalGroupLeadName(managerName: string): boolean {
  const surname = managerName.trim().split(/\s+/)[0] ?? '';
  return DIGITAL_GROUP_LEAD_SURNAMES.has(surname);
}

export function needsTwoStepApproval(employee: VacationEmployeeRef): boolean {
  const cfg = getTwoStepConfig(employee.department);
  if (!cfg) return false;
  return cfg.isGroupLeadManager(employee.manager);
}

/** @deprecated Используйте needsTwoStepApproval */
export function needsDigitalTwoStepApproval(employee: VacationEmployeeRef): boolean {
  return needsTwoStepApproval(employee);
}

const isDirectorSelfRequest = (
  requestEmployeeName: string | undefined,
  employee: VacationEmployeeRef
): boolean => {
  if (!requestEmployeeName) return false;
  const cfg = getTwoStepConfig(employee.department);
  if (!cfg) return false;
  return employeeNamesMatch(requestEmployeeName, cfg.directorName);
};

export function initialApprovalStep(
  employee: VacationEmployeeRef,
  requestEmployeeName?: string
): VacationApprovalStep {
  if (isDirectorSelfRequest(requestEmployeeName, employee)) return 'manager';
  if (needsTwoStepApproval(employee)) return 'manager';
  const cfg = getTwoStepConfig(employee.department);
  if (cfg) return 'director';
  return 'manager';
}

export function resolveRequestApprovalStep(
  request: { status: string; approval_step?: VacationApprovalStep; employee?: string },
  employee: VacationEmployeeRef | undefined
): VacationApprovalStep | null {
  if (request.status !== 'pending') return null;
  const requestEmployeeName =
    typeof request.employee === 'string' ? request.employee : undefined;
  if (request.approval_step) {
    if (
      request.approval_step === 'director' &&
      employee &&
      isDirectorSelfRequest(requestEmployeeName, employee)
    ) {
      return 'manager';
    }
    return request.approval_step;
  }
  if (!employee) return 'manager';
  return initialApprovalStep(employee, requestEmployeeName);
}

export function canApproverReviewRequest(
  approver: string | VacationApproverRef,
  request: {
    status: string;
    approval_step?: VacationApprovalStep;
    employee: string;
    employee_id?: number | null;
  },
  employee: VacationEmployeeRef | undefined,
  /** Резолв директора отдела в id справочника (для сравнения без ФИО). */
  resolvePersonId?: (name: string) => number | null | undefined
): boolean {
  if (request.status !== 'pending' || !employee) return false;

  const who = asApprover(approver);
  const requestEmployeeId = Number(request.employee_id ?? employee.id);
  if (
    samePerson(
      who,
      request.employee,
      Number.isFinite(requestEmployeeId) && requestEmployeeId > 0 ? requestEmployeeId : null
    )
  ) {
    return false;
  }

  const step = resolveRequestApprovalStep(request, employee);
  if (!step) return false;

  if (step === 'manager') {
    return samePerson(who, employee.manager, employee.manager_id ?? null);
  }

  const cfg = getTwoStepConfig(employee.department);
  if (cfg) {
    const directorId = resolvePersonId?.(cfg.directorName) ?? null;
    return samePerson(who, cfg.directorName, directorId);
  }

  return samePerson(who, employee.manager, employee.manager_id ?? null);
}

/** Имя сотрудника в справочнике, который сейчас должен согласовать заявку. */
export function resolveApproverEmployeeName(
  request: { status: string; approval_step?: VacationApprovalStep; employee?: string },
  employee: VacationEmployeeRef
): string | null {
  const step = resolveRequestApprovalStep(request, employee);
  if (!step) return null;
  if (step === 'manager') {
    const name = employee.manager.trim();
    return name || null;
  }
  const cfg = getTwoStepConfig(employee.department);
  if (cfg) {
    const director = cfg.directorName.trim();
    const requestEmployeeName =
      typeof request.employee === 'string' ? request.employee.trim() : '';
    if (director && !employeeNamesMatch(director, requestEmployeeName)) return director;
  }
  const fallback = employee.manager.trim();
  return fallback || null;
}

/** Заявка ушла на директора после согласования тимлидом — только для отображения. */
export function isHandedOffToDirectorForGroupLead(
  groupLead: string | VacationApproverRef,
  request: { status: string; approval_step?: VacationApprovalStep },
  employee: VacationEmployeeRef | undefined
): boolean {
  if (request.status !== 'pending' || !employee) return false;
  if (!needsTwoStepApproval(employee)) return false;
  const step = resolveRequestApprovalStep(request, employee);
  if (step !== 'director') return false;
  const who = asApprover(groupLead);
  return samePerson(who, employee.manager, employee.manager_id ?? null);
}

export function nextStateAfterApproval(
  employee: VacationEmployeeRef,
  currentStep: VacationApprovalStep
): { status: 'pending' | 'approved'; approval_step?: VacationApprovalStep } {
  if (currentStep === 'manager' && needsTwoStepApproval(employee)) {
    return { status: 'pending', approval_step: 'director' };
  }
  return { status: 'approved', approval_step: undefined };
}

export function vacationPendingStatusLabel(
  step: VacationApprovalStep | null | undefined,
  employee?: VacationEmployeeRef
): string {
  if (step === 'director') {
    const cfg = employee ? getTwoStepConfig(employee.department) : null;
    return cfg?.directorStepLabel ?? 'На согласовании у директора';
  }
  if (step === 'manager') return 'На согласовании у руководителя';
  return 'На согласовании';
}

export type VacationApprovalPathSegState = 'done' | 'current' | 'todo' | 'rejected';

export type VacationApprovalPathSeg = {
  label: string;
  state: VacationApprovalPathSegState;
};

/**
 * Путь согласования (полоски) — всегда 3 сегмента одного размера:
 * 1 Создана → 2 текущий согласующий → 3 Согласована
 *
 * Digital (двухэтапный): средняя полоска одна —
 * сначала «У группхеда», после его ок кружок остаётся, текст → «У директора»;
 * после ок директора — все «done», как в обычном режиме.
 */
export function resolveVacationApprovalPath(
  request: { status: string; approval_step?: VacationApprovalStep; employee?: string },
  employee?: VacationEmployeeRef | null
): VacationApprovalPathSeg[] {
  const twoStep = employee ? needsTwoStepApproval(employee) : false;
  const inTwoStepDept = Boolean(employee && getTwoStepConfig(employee.department));
  const step = resolveRequestApprovalStep(request, employee ?? undefined);

  const middleLabel = (() => {
    if (twoStep) {
      // После группхеда (director / approved / reject на директоре) — «У директора»
      if (request.status === 'approved') return 'У директора';
      if (step === 'director') return 'У директора';
      if (request.status === 'rejected' && request.approval_step === 'director') return 'У директора';
      return 'У группхеда';
    }
    if (inTwoStepDept) return 'У директора';
    return 'У руководителя';
  })();

  const labels = ['Создана', middleLabel, 'Согласована'];

  if (request.status === 'approved') {
    return labels.map((label) => ({ label, state: 'done' as const }));
  }

  /** Средний сегмент (индекс 1) — пока заявка на любом согласующем. */
  const currentIdx = 1;

  if (request.status === 'rejected') {
    return labels.map((label, index) => {
      if (index < currentIdx) return { label, state: 'done' as const };
      if (index === currentIdx) return { label, state: 'rejected' as const };
      return { label, state: 'todo' as const };
    });
  }

  if (request.status === 'pending') {
    return labels.map((label, index) => {
      if (index < currentIdx) return { label, state: 'done' as const };
      if (index === currentIdx) return { label, state: 'current' as const };
      return { label, state: 'todo' as const };
    });
  }

  return labels.map((label, index) => ({
    label,
    state: index === 0 ? ('done' as const) : ('todo' as const)
  }));
}
