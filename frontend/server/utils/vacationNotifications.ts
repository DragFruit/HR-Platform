import type { VacationRequest } from '../../app/composables/useVacations';
import {
  resolveApproverEmployeeName,
  resolveDepartmentDirectorName,
  resolveRequestApprovalStep,
  vacationPendingStatusLabel,
  type VacationApprovalStep
} from '../../app/utils/vacationApproval';
import { findEmployeeByName } from './employeesStore';
import { createUserNotification, type UserNotificationKind } from './userNotificationsStore';

const userIdForEmployeeName = async (name: string): Promise<number | null> => {
  const emp = await findEmployeeByName(name);
  if (!emp) return null;
  const uid = emp.platform_user_id ?? emp.bitrix_user_id ?? null;
  return uid && uid > 0 ? uid : null;
};

const notifyUser = async (
  recipientUserId: number,
  kind: UserNotificationKind,
  request: VacationRequest,
  extra?: { stage_label?: string }
) => {
  await createUserNotification({
    kind,
    recipient_user_id: recipientUserId,
    vacation_request_id: request.id,
    employee_name: request.employee,
    start: request.start,
    end: request.end,
    stage_label: extra?.stage_label
  });
};

const notifyApprover = async (request: VacationRequest) => {
  const employee = await findEmployeeByName(request.employee);
  if (!employee || request.status !== 'pending') return;

  const approverName = resolveApproverEmployeeName(request, employee);
  if (!approverName) return;

  const recipientId = await userIdForEmployeeName(approverName);
  if (!recipientId) return;

  await notifyUser(recipientId, 'vacation_submitted', request);
};

/** Руководитель из справочника + директор отдела (если есть и это не тот же человек). */
const notifyManagersForEmployee = async (
  request: VacationRequest,
  kind: UserNotificationKind,
  options: { includeDirector: boolean }
) => {
  const employee = await findEmployeeByName(request.employee);
  if (!employee) return;

  const names = new Set<string>();
  const managerName = employee.manager.trim();
  if (managerName) names.add(managerName);

  if (options.includeDirector) {
    const directorName = resolveDepartmentDirectorName(employee)?.trim();
    if (directorName) names.add(directorName);
  }

  for (const name of names) {
    const recipientId = await userIdForEmployeeName(name);
    if (!recipientId) continue;
    await notifyUser(recipientId, kind, request);
  }
};

const notifyEmployee = async (
  request: VacationRequest,
  kind: UserNotificationKind,
  stageLabel?: string
) => {
  const recipientId = await userIdForEmployeeName(request.employee);
  if (!recipientId) return;
  await notifyUser(recipientId, kind, request, stageLabel ? { stage_label: stageLabel } : undefined);
};

const approvalStep = (
  request: VacationRequest,
  employee: { department: string; manager: string }
): VacationApprovalStep | null => resolveRequestApprovalStep(request, employee);

/** Новая заявка → текущему согласующему (руководитель или директор). */
export async function notifyVacationRequestCreated(request: VacationRequest) {
  await notifyApprover(request);
}

export async function notifyVacationRequestPatched(
  previous: VacationRequest,
  next: VacationRequest
) {
  const employee = await findEmployeeByName(next.employee);
  if (!employee) return;

  const datesChanged = previous.start !== next.start || previous.end !== next.end;
  if (datesChanged && next.status === 'pending') {
    await notifyManagersForEmployee(next, 'vacation_updated', { includeDirector: true });
  }

  if (next.status === 'approved' && previous.status !== 'approved') {
    await notifyEmployee(next, 'vacation_approved');
    return;
  }

  if (next.status === 'rejected' && previous.status !== 'rejected') {
    await notifyEmployee(next, 'vacation_rejected');
    return;
  }

  if (next.status !== 'pending' || previous.status !== 'pending') return;

  const prevStep = approvalStep(previous, employee);
  const nextStep = approvalStep(next, employee);
  if (prevStep !== nextStep && nextStep) {
    const stageLabel = vacationPendingStatusLabel(nextStep, employee);
    await notifyEmployee(next, 'vacation_next_stage', stageLabel);
    if (nextStep === 'director') {
      await notifyApprover(next);
    }
  }
}

/** Удаление заявки → руководителю и директору отдела. */
export async function notifyVacationRequestDeleted(request: VacationRequest) {
  await notifyManagersForEmployee(request, 'vacation_deleted', { includeDirector: true });
}
