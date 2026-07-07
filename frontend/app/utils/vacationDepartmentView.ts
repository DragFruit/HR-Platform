import { QA_EMPLOYEE_NAME, QA_TEST_DEPARTMENT_NAME } from '~/data/qaTestDepartment';

/**
 * Сотрудники с доступом к календарю отпусков всего отдела без права согласования.
 * Ключ — ФИО из справочника, значение — код отдела (как в employees.department).
 */
export const DEPARTMENT_VACATION_VIEWERS: Record<string, string> = {
  /** Демо: katya@vbi.local → Даша Тестова, отдел «Тестировщики». */
  [QA_EMPLOYEE_NAME]: QA_TEST_DEPARTMENT_NAME
};

export function departmentVacationViewScope(profileName: string): string | null {
  const scope = DEPARTMENT_VACATION_VIEWERS[profileName.trim()];
  return scope?.trim() || null;
}

export function isDepartmentVacationViewer(profileName: string): boolean {
  return Boolean(departmentVacationViewScope(profileName));
}
