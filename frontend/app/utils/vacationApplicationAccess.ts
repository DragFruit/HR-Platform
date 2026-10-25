import { isLaborContractEmployee } from '../data/employeeDirectoryOptions';
import { employeeNamesMatch } from './employeeName';

/**
 * «Скачать заявление» на отпуск: общие правила для UI и API.
 * С 2026-10-20 (просьба заказчика) — сразу после создания заявки:
 * `pending` на любом шаге согласования и `approved`. `rejected` — нет.
 */
export const VACATION_APPLICATION_STATUSES = ['pending', 'approved'] as const;

export const isVacationApplicationStatusAllowed = (status: string | null | undefined): boolean =>
  (VACATION_APPLICATION_STATUSES as readonly string[]).includes(String(status ?? ''));

export type VacationApplicationRuleInput = {
  status: string | null | undefined;
  start: string;
  today: string;
  contractForm: string | null | undefined;
};

/** null — можно скачать; иначе текст отказа (для 403). */
export const vacationApplicationDenyReason = (input: VacationApplicationRuleInput): string | null => {
  if (!isVacationApplicationStatusAllowed(input.status)) {
    return 'Заявление недоступно для отклонённой заявки';
  }
  if (!(input.start > input.today)) return 'Заявление доступно до начала отпуска';
  if (!isLaborContractEmployee(input.contractForm)) {
    return 'Заявление доступно только сотрудникам с трудовым договором (ТД)';
  }
  return null;
};

export type VacationApplicationViewer = {
  role: string | null | undefined;
  employeeId?: string | number | null;
  employeeName?: string | null;
};

/** Доступ: владелец заявки или HR/admin (как и раньше). */
export const canViewVacationApplication = (
  viewer: VacationApplicationViewer,
  request: { employee: string; employee_id?: string | number | null }
): boolean => {
  if (viewer.role === 'admin' || viewer.role === 'hr') return true;
  if (viewer.employeeId && request.employee_id && String(viewer.employeeId) === String(request.employee_id)) {
    return true;
  }
  return Boolean(viewer.employeeName && employeeNamesMatch(viewer.employeeName, request.employee));
};
