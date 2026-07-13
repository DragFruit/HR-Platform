import { initialApprovalStep, type VacationApprovalStep } from '../../app/utils/vacationApproval';
import type { VacationRequest, VacationStatus } from '../../app/composables/useVacations';
import {
  GROUP_LEAD_OVERLAP_BLOCKED_MESSAGE,
  hasGroupLeadVacationOverlap
} from '../../app/utils/vacationGroupLeadOverlap';
import { recordQaDemoVacationDeletion } from '../../app/data/qaTestVacationSeed';
import { syncApprovedVacationsToBitrix } from './bitrixVacationAbsence';
import { findEmployeeByName } from './employeesStore';
import {
  notifyVacationRequestCreated,
  notifyVacationRequestDeleted,
  notifyVacationRequestPatched
} from './vacationNotifications';
import { mutateVacations, type VacationStoreState } from './vacationsStore';

const cloneState = (state: VacationStoreState): VacationStoreState =>
  JSON.parse(JSON.stringify(state)) as VacationStoreState;

const findRequest = (state: VacationStoreState, id: number) => {
  for (const [yearKey, list] of Object.entries(state.requestsByYear)) {
    const index = list.findIndex((item) => item.id === id);
    if (index !== -1) return { yearKey, list, index, item: list[index]! };
  }
  return null;
};

export type CreateVacationRequestBody = {
  year: number;
  employee: string;
  start: string;
  end: string;
  comment?: string;
};

export type PatchVacationRequestBody = {
  start?: string;
  end?: string;
  status?: VacationStatus;
  approval_step?: VacationApprovalStep | null;
};

const assertGroupLeadVacationOverlap = (
  state: VacationStoreState,
  employee: { name: string; department: string },
  start: string,
  end: string,
  excludeRequestId?: number
) => {
  const allRequests = Object.values(state.requestsByYear).flat();
  const blocked = hasGroupLeadVacationOverlap({
    employeeName: employee.name,
    department: employee.department,
    start,
    end,
    allRequests,
    excludeRequestId
  });
  if (blocked) {
    throw createError({
      statusCode: 409,
      statusMessage: GROUP_LEAD_OVERLAP_BLOCKED_MESSAGE
    });
  }
};

export async function createVacationRequest(
  body: CreateVacationRequestBody
): Promise<VacationStoreState> {
  const employee = await findEmployeeByName(body.employee);
  const yearKey = String(body.year);

  const request: VacationRequest = {
    id: 0,
    employee: body.employee.trim(),
    start: body.start,
    end: body.end,
    status: 'pending',
    approval_step: employee ? initialApprovalStep(employee, body.employee) : 'manager',
    comment: body.comment?.trim() || 'Заявка из платформы',
    createdAt: new Date().toLocaleDateString('ru-RU')
  };

  let createdRequest: VacationRequest | null = null;

  const result = await mutateVacations((state) => {
    if (employee) {
      assertGroupLeadVacationOverlap(state, employee, body.start, body.end);
    }
    request.id = state.nextRequestId++;
    const list = state.requestsByYear[yearKey] ?? [];
    state.requestsByYear[yearKey] = [...list, request];
    createdRequest = { ...request };
    return state;
  });

  if (createdRequest) {
    await notifyVacationRequestCreated(createdRequest);
  }

  return result;
}

export async function patchVacationRequest(
  id: number,
  patch: PatchVacationRequestBody
): Promise<VacationStoreState> {
  let previousRequest: VacationRequest | null = null;
  let nextRequest: VacationRequest | null = null;

  const result = await mutateVacations(async (state) => {
    const previous = cloneState(state);
    const found = findRequest(state, id);
    if (!found) {
      throw createError({ statusCode: 404, statusMessage: 'Заявка не найдена' });
    }

    previousRequest = { ...found.item };

    if (patch.start !== undefined) found.item.start = patch.start;
    if (patch.end !== undefined) found.item.end = patch.end;

    const employee = await findEmployeeByName(found.item.employee);
    if (employee && (patch.start !== undefined || patch.end !== undefined)) {
      assertGroupLeadVacationOverlap(
        state,
        employee,
        found.item.start,
        found.item.end,
        found.item.id
      );
    }

    if (patch.status !== undefined) {
      found.item.status = patch.status;
      if (patch.status !== 'pending') {
        delete found.item.approval_step;
      }
    }
    if (patch.approval_step !== undefined) {
      if (patch.approval_step === null) {
        delete found.item.approval_step;
      } else {
        found.item.approval_step = patch.approval_step;
      }
    }

    nextRequest = { ...found.item };
    return syncApprovedVacationsToBitrix(previous, state);
  });

  if (previousRequest && nextRequest) {
    await notifyVacationRequestPatched(previousRequest, nextRequest);
  }

  return result;
}

export async function deleteVacationRequest(id: number): Promise<VacationStoreState> {
  let removedRequest: VacationRequest | null = null;

  const result = await mutateVacations((state) => {
    const found = findRequest(state, id);
    if (!found) {
      throw createError({ statusCode: 404, statusMessage: 'Заявка не найдена' });
    }
    removedRequest = { ...found.item };
    const nextList = found.list.filter((item) => item.id !== id);
    state.requestsByYear[found.yearKey] = nextList;
    state.qaDemoSuppressed = recordQaDemoVacationDeletion(state.qaDemoSuppressed, 'request', id);
    return state;
  });

  if (removedRequest) {
    await notifyVacationRequestDeleted(removedRequest);
  }

  return result;
}
