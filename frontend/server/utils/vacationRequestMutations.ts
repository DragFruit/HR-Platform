import { initialApprovalStep, type VacationApprovalStep } from '../../app/utils/vacationApproval';
import type { VacationRequest, VacationStatus } from '../../app/composables/useVacations';
import { syncApprovedVacationsToBitrix } from './bitrixVacationAbsence';
import { findEmployeeByName } from './employeesStore';
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
    approval_step: employee ? initialApprovalStep(employee) : 'manager',
    comment: body.comment?.trim() || 'Заявка из платформы',
    createdAt: new Date().toLocaleDateString('ru-RU')
  };

  return mutateVacations((state) => {
    request.id = state.nextRequestId++;
    const list = state.requestsByYear[yearKey] ?? [];
    state.requestsByYear[yearKey] = [...list, request];
    return state;
  });
}

export async function patchVacationRequest(
  id: number,
  patch: PatchVacationRequestBody
): Promise<VacationStoreState> {
  return mutateVacations(async (state) => {
    const previous = cloneState(state);
    const found = findRequest(state, id);
    if (!found) {
      throw createError({ statusCode: 404, statusMessage: 'Заявка не найдена' });
    }

    if (patch.start !== undefined) found.item.start = patch.start;
    if (patch.end !== undefined) found.item.end = patch.end;
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

    return syncApprovedVacationsToBitrix(previous, state);
  });
}

export async function deleteVacationRequest(id: number): Promise<VacationStoreState> {
  return mutateVacations((state) => {
    const found = findRequest(state, id);
    if (!found) {
      throw createError({ statusCode: 404, statusMessage: 'Заявка не найдена' });
    }
    const nextList = found.list.filter((item) => item.id !== id);
    state.requestsByYear[found.yearKey] = nextList;
    return state;
  });
}
