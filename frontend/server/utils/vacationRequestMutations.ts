import { initialApprovalStep, type VacationApprovalStep } from '../../app/utils/vacationApproval';
import type { VacationRequest, VacationStatus } from '../../app/composables/useVacations';
import {
  GROUP_LEAD_OVERLAP_BLOCKED_MESSAGE,
  hasGroupLeadVacationOverlap
} from '../../app/utils/vacationGroupLeadOverlap';
import { recordQaDemoVacationDeletion } from '../../app/data/qaTestVacationSeed';
import { syncApprovedVacationsToBitrix, removeVacationAbsenceFromBitrix } from './bitrixVacationAbsence';
import { createBitrixVacationAbsenceFailedNotification } from './adminNotificationsStore';
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

/** Год папки requestsByYear должен совпадать с годом даты начала. */
const yearFromIsoDate = (iso: string): number => {
  const y = Number(String(iso || '').slice(0, 4));
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Некорректная дата отпуска'
    });
  }
  return y;
};

const assertYearMatchesStart = (year: number, start: string) => {
  const startYear = yearFromIsoDate(start);
  if (startYear !== year) {
    throw createError({
      statusCode: 400,
      statusMessage: `Год заявки (${year}) не совпадает с датой начала (${startYear})`
    });
  }
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
    if (body.year < state.primaryYear) {
      throw createError({
        statusCode: 400,
        statusMessage: `За ${body.year} год заявки создать нельзя — год только для просмотра`
      });
    }
    assertYearMatchesStart(body.year, body.start);
    yearFromIsoDate(body.end);
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

    if (patch.start !== undefined || patch.end !== undefined) {
      yearFromIsoDate(found.item.end);
      const startYear = yearFromIsoDate(found.item.start);
      const bucketYear = Number(found.yearKey);
      if (startYear !== bucketYear) {
        // Дата уехала в другой год — переносим заявку в правильную папку.
        const nextList = found.list.filter((item) => item.id !== id);
        state.requestsByYear[found.yearKey] = nextList;
        const targetKey = String(startYear);
        const target = state.requestsByYear[targetKey] ?? [];
        state.requestsByYear[targetKey] = [...target, found.item];
      }
    }

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
    const removed = removedRequest as VacationRequest;
    if (removed.bitrix_absence_id) {
      try {
        await removeVacationAbsenceFromBitrix(removed);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[bitrix-vacation] remove on delete failed for request #${id}:`, message);
        try {
          const employee = await findEmployeeByName(removed.employee);
          await createBitrixVacationAbsenceFailedNotification({
            employee_id: employee?.id ?? employee?.bitrix_user_id ?? employee?.platform_user_id ?? 0,
            employee_name: removed.employee,
            vacation_request_id: removed.id,
            vacation_start: removed.start,
            vacation_end: removed.end,
            absence_action: 'remove',
            error_message: message
          });
        } catch (notifyError) {
          console.error(
            '[bitrix-vacation] admin notify on delete failed:',
            notifyError instanceof Error ? notifyError.message : String(notifyError)
          );
        }
      }
    }
    await notifyVacationRequestDeleted(removed);
  }

  return result;
}
