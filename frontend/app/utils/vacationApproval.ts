import {
  QA_DIRECTOR_NAME,
  QA_TEAM_LEAD_NAME,
  QA_TEST_DEPARTMENT_NAME
} from '~/data/qaTestDepartment';

export type VacationApprovalStep = 'manager' | 'director';

export const DIGITAL_DIRECTOR_NAME = 'Ревзина Ксения';

const DIGITAL_GROUP_LEAD_SURNAMES = new Set(['Попов', 'Лунин', 'Цхай', 'Носков']);

export type VacationEmployeeRef = {
  department: string;
  manager: string;
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
    isGroupLeadManager: (managerName) => managerName.trim() === QA_TEAM_LEAD_NAME
  }
];

function getTwoStepConfig(department: string): TwoStepDepartmentConfig | undefined {
  return TWO_STEP_DEPARTMENTS.find((cfg) => cfg.department === department.trim());
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

export function initialApprovalStep(employee: VacationEmployeeRef): VacationApprovalStep {
  if (needsTwoStepApproval(employee)) return 'manager';
  const cfg = getTwoStepConfig(employee.department);
  if (cfg) return 'director';
  return 'manager';
}

export function resolveRequestApprovalStep(
  request: { status: string; approval_step?: VacationApprovalStep },
  employee: VacationEmployeeRef | undefined
): VacationApprovalStep | null {
  if (request.status !== 'pending') return null;
  if (request.approval_step) return request.approval_step;
  if (!employee) return 'manager';
  return initialApprovalStep(employee);
}

export function canApproverReviewRequest(
  approverName: string,
  request: { status: string; approval_step?: VacationApprovalStep; employee: string },
  employee: VacationEmployeeRef | undefined
): boolean {
  if (request.status !== 'pending' || !employee) return false;

  const approver = approverName.trim();
  const step = resolveRequestApprovalStep(request, employee);
  if (!step) return false;

  if (step === 'manager') {
    return approver === employee.manager.trim();
  }

  const cfg = getTwoStepConfig(employee.department);
  if (cfg) {
    return approver === cfg.directorName;
  }

  return approver === employee.manager.trim();
}

/** Заявка ушла на директора после согласования тимлидом — только для отображения. */
export function isHandedOffToDirectorForGroupLead(
  groupLeadName: string,
  request: { status: string; approval_step?: VacationApprovalStep },
  employee: VacationEmployeeRef | undefined
): boolean {
  if (request.status !== 'pending' || !employee) return false;
  if (!needsTwoStepApproval(employee)) return false;
  const step = resolveRequestApprovalStep(request, employee);
  if (step !== 'director') return false;
  return groupLeadName.trim() === employee.manager.trim();
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
