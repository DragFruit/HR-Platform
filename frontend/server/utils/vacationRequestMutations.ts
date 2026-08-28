import {
  canApproverReviewRequest,
  initialApprovalStep,
  nextStateAfterApproval,
  resolveRequestApprovalStep,
  type VacationApprovalStep,
  type VacationEmployeeRef
} from '../../app/utils/vacationApproval';
import type { VacationRequest, VacationStatus } from '../../app/composables/useVacations';
import {
  GROUP_LEAD_OVERLAP_BLOCKED_MESSAGE,
  hasGroupLeadVacationOverlap
} from '../../app/utils/vacationGroupLeadOverlap';
import { recordQaDemoVacationDeletion } from '../../app/data/qaTestVacationSeed';
import { syncApprovedVacationsToBitrix, removeVacationAbsenceFromBitrix } from './bitrixVacationAbsence';
import { createBitrixVacationSyncFailedNotification } from './adminNotificationsStore';
import type { SessionUser } from './credentials';
import { findEmployeeByName, findEmployeeForSession } from './employeesStore';
import {
  notifyVacationRequestCreated,
  notifyVacationRequestDeleted,
  notifyVacationRequestPatched
} from './vacationNotifications';
import { assertVacationRequestGroupCap } from './vacationReservationCapMutations';
import { mutateVacations, type VacationStoreState } from './vacationsStore';
import { isPastApprovedVacationRequest } from '../../app/utils/vacationCalendar';

const cloneState = (state: VacationStoreState): VacationStoreState =>
  JSON.parse(JSON.stringify(state)) as VacationStoreState;

const sameEmployeeName = (a?: string | null, b?: string | null): boolean =>
  Boolean(a && b) && a!.trim().toLowerCase() === b!.trim().toLowerCase();

/** HR и админ ведут график за всех: подают, правят и согласовывают заявки любого сотрудника. */
const hasRosterWideRights = (session: SessionUser): boolean =>
  session.role === 'admin' || session.role === 'hr';

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
  session: SessionUser,
  body: CreateVacationRequestBody
): Promise<VacationStoreState> {
  const sessionEmployee = await findEmployeeForSession(session);
  const employeeName = body.employee?.trim() || sessionEmployee?.name?.trim() || '';

  if (!employeeName) {
    throw createError({ statusCode: 400, statusMessage: 'Не удалось определить сотрудника' });
  }

  if (!sameEmployeeName(employeeName, sessionEmployee?.name) && !hasRosterWideRights(session)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Нельзя подать заявку за другого сотрудника'
    });
  }

  const employee = await findEmployeeByName(employeeName);
  const yearKey = String(body.year);

  const request: VacationRequest = {
    id: 0,
    employee: employeeName,
    start: body.start,
    end: body.end,
    status: 'pending',
    approval_step: employee ? initialApprovalStep(employee, employeeName) : 'manager',
    comment: body.comment?.trim() || 'Заявка из платформы',
    createdAt: new Date().toLocaleDateString('ru-RU')
  };

  let createdRequest: VacationRequest | null = null;

  const result = await mutateVacations(async (state) => {
    if (body.year < state.primaryYear) {
      throw createError({
        statusCode: 400,
        statusMessage: `За ${body.year} год заявки создать нельзя — год только для просмотра`
      });
    }
    assertYearMatchesStart(body.year, body.start);
    yearFromIsoDate(body.end);
    if (employee && session.role !== 'admin') {
      assertGroupLeadVacationOverlap(state, employee, body.start, body.end);
    }
    if (employee && session.role !== 'admin') {
      await assertVacationRequestGroupCap(state, employeeName, body.start, body.end);
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
  session: SessionUser,
  id: number,
  patch: PatchVacationRequestBody
): Promise<VacationStoreState> {
  let previousRequest: VacationRequest | null = null;
  let nextRequest: VacationRequest | null = null;

  const sessionEmployee = await findEmployeeForSession(session);
  const elevated = hasRosterWideRights(session);
  const changesDates = patch.start !== undefined || patch.end !== undefined;
  const changesDecision = patch.status !== undefined || patch.approval_step !== undefined;

  const result = await mutateVacations(async (state) => {
    const previous = cloneState(state);
    const found = findRequest(state, id);
    if (!found) {
      throw createError({ statusCode: 404, statusMessage: 'Заявка не найдена' });
    }

    const owner = await findEmployeeByName(found.item.employee);
    const isOwnRequest = sameEmployeeName(sessionEmployee?.name, found.item.employee);

    if (changesDates && !elevated && !isOwnRequest) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Нет прав изменить даты этой заявки'
      });
    }

    // Как в UI (`canManageRequest` / обучалка): свою заявку можно править,
    // пока согласованный отпуск не полностью прошёл. Прошедший approved — только просмотр.
    if (changesDates && !elevated && isPastApprovedVacationRequest(found.item)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Прошедший согласованный отпуск нельзя менять'
      });
    }

    // Согласование: решение принимает только текущий согласующий по цепочке.
    // Значения из тела запроса не применяем — шаг считаем сами, иначе заявку
    // можно перевести в approved в обход руководителя и директора.
    let decision: { status: VacationStatus; approval_step?: VacationApprovalStep } | null = null;

    if (changesDecision && !elevated) {
      if (found.item.status !== 'pending') {
        throw createError({
          statusCode: 409,
          statusMessage: 'Заявка уже обработана — обновите страницу'
        });
      }

      const approverName = sessionEmployee?.name?.trim() || '';
      const canReview =
        Boolean(owner) && canApproverReviewRequest(approverName, found.item, owner as VacationEmployeeRef);
      if (!canReview) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Нет прав согласовать эту заявку'
        });
      }

      if (patch.status === 'rejected') {
        decision = { status: 'rejected' };
      } else if (patch.status === 'approved' || patch.approval_step !== undefined) {
        const step = resolveRequestApprovalStep(found.item, owner as VacationEmployeeRef);
        if (!step) {
          throw createError({ statusCode: 409, statusMessage: 'Заявку уже нельзя согласовать' });
        }
        decision = nextStateAfterApproval(owner as VacationEmployeeRef, step);
      } else {
        throw createError({
          statusCode: 400,
          statusMessage: 'Некорректное решение по заявке'
        });
      }
    }

    // HR/админ тоже не откатывают согласованную заявку в pending через старую вкладку —
    // только approve/reject (или правка дат с сохранением статуса).
    if (changesDecision && elevated && patch.status === 'pending' && found.item.status !== 'pending') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Нельзя вернуть обработанную заявку в «на согласовании»'
      });
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

    if (owner && changesDates && session.role !== 'admin') {
      assertGroupLeadVacationOverlap(
        state,
        owner,
        found.item.start,
        found.item.end,
        found.item.id
      );
    }

    if (owner && changesDates && session.role !== 'admin') {
      await assertVacationRequestGroupCap(state, found.item.employee, found.item.start, found.item.end);
    }

    if (decision) {
      found.item.status = decision.status;
      if (decision.approval_step) found.item.approval_step = decision.approval_step;
      else delete found.item.approval_step;
    } else {
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
    }

    nextRequest = { ...found.item };
    return syncApprovedVacationsToBitrix(previous, state);
  });

  // Отклонили ранее согласованный отпуск — пальму в Bitrix снимаем (как при удалении).
  if (
    previousRequest &&
    nextRequest &&
    previousRequest.status === 'approved' &&
    nextRequest.status === 'rejected' &&
    previousRequest.bitrix_absence_id
  ) {
    try {
      await removeVacationAbsenceFromBitrix(previousRequest);
      await mutateVacations((state) => {
        const found = findRequest(state, id);
        if (!found) return state;
        delete found.item.bitrix_absence_id;
        found.item.bitrix_sync_status = undefined;
        found.item.bitrix_sync_method = undefined;
        found.item.bitrix_synced_at = undefined;
        found.item.bitrix_sync_error = undefined;
        return state;
      });
      if (nextRequest) {
        nextRequest = {
          ...nextRequest,
          bitrix_absence_id: undefined,
          bitrix_sync_status: undefined,
          bitrix_sync_method: undefined,
          bitrix_synced_at: undefined,
          bitrix_sync_error: undefined
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[bitrix-vacation] remove on reject failed for request #${id}:`, message);
      try {
        const employee = await findEmployeeByName(previousRequest.employee);
        await createBitrixVacationSyncFailedNotification({
          employee_id: employee?.id ?? employee?.bitrix_user_id ?? employee?.platform_user_id ?? 0,
          employee_name: previousRequest.employee,
          bitrix_user_id: employee?.bitrix_user_id ?? undefined,
          request_id: previousRequest.id,
          start: previousRequest.start,
          end: previousRequest.end,
          error: `Не удалось снять отметку об отпуске в Bitrix при отклонении заявки: ${message}`
        });
      } catch (notifyError) {
        console.error(
          '[bitrix-vacation] admin notify on reject failed:',
          notifyError instanceof Error ? notifyError.message : String(notifyError)
        );
      }
    }
  }

  if (previousRequest && nextRequest) {
    await notifyVacationRequestPatched(previousRequest, nextRequest);
  }

  return result;
}

export async function deleteVacationRequest(
  session: SessionUser,
  id: number
): Promise<VacationStoreState> {
  let removedRequest: VacationRequest | null = null;

  const sessionEmployee = await findEmployeeForSession(session);
  const elevated = hasRosterWideRights(session);

  const result = await mutateVacations((state) => {
    const found = findRequest(state, id);
    if (!found) {
      throw createError({ statusCode: 404, statusMessage: 'Заявка не найдена' });
    }
    if (!elevated && !sameEmployeeName(sessionEmployee?.name, found.item.employee)) {
      throw createError({ statusCode: 403, statusMessage: 'Нет прав удалить эту заявку' });
    }
    if (!elevated && isPastApprovedVacationRequest(found.item)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Прошедший согласованный отпуск нельзя удалить'
      });
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
          await createBitrixVacationSyncFailedNotification({
            employee_id: employee?.id ?? employee?.bitrix_user_id ?? employee?.platform_user_id ?? 0,
            employee_name: removed.employee,
            bitrix_user_id: employee?.bitrix_user_id ?? undefined,
            request_id: removed.id,
            start: removed.start,
            end: removed.end,
            error: `Не удалось снять отметку об отпуске в Bitrix при удалении заявки: ${message}`
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
