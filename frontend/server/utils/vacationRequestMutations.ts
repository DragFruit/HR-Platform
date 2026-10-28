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
import { isBitrixWriteBlockedError } from './bitrixWriteGuard';
import type { SessionUser } from './credentials';
import { findEmployeeByName, findEmployeeForSession, readEmployees } from './employeesStore';
import {
  notifyVacationRequestCreated,
  notifyVacationRequestDeleted,
  notifyVacationRequestPatched
} from './vacationNotifications';
import { assertVacationRequestGroupCap } from './vacationReservationCapMutations';
import { mutateVacations, type VacationStoreState } from './vacationsStore';
import {
  isPastApprovedVacationRequest,
  isVacationStartInPast,
  todayIso,
  vacationRangesOverlap
} from '../../app/utils/vacationCalendar';
import { vacationBelongsToEmployee } from '../../app/utils/vacationEmployeeRef';
import { employeeNamesMatch } from '../../app/utils/employeeName';
import { vacationBookingYearError } from '../../app/utils/vacationBookingYears';
import {
  assessVacationShortfall,
  isVacationShortfallBlocking
} from '../../app/utils/vacationShortfall';

/**
 * Нельзя подать заявку больше доступного остатка (та же проверка, что в форме).
 * Только сотрудник для себя; HR/админ за другого могут оформить с нехваткой (исключения).
 */
const assertVacationBalanceSufficient = (
  state: VacationStoreState,
  employee: { name: string; hired_at?: string | null; vacation_opening_balance?: number | null } | null,
  start: string,
  end: string,
  blocking: boolean,
  excludeRequestId?: number
) => {
  if (!blocking || !employee) return;
  const { shortfall, message } = assessVacationShortfall({
    employeeName: employee.name,
    hireIso: employee.hired_at,
    start,
    end,
    requests: Object.values(state.requestsByYear).flat(),
    primaryYear: state.primaryYear,
    excludeRequestId,
    openingBalance: employee.vacation_opening_balance
  });
  if (shortfall > 0) {
    throw createError({ statusCode: 400, statusMessage: message });
  }
};

/** Новые даты — только на текущий учётный год или следующий (прошлые заявки правятся как раньше). */
const assertBookableVacationYear = (
  primaryYear: number,
  start: string,
  end: string,
  previousStart?: string
) => {
  const message = vacationBookingYearError(start, end, primaryYear, previousStart);
  if (message) throw createError({ statusCode: 400, statusMessage: message });
};

const cloneState = (state: VacationStoreState): VacationStoreState =>
  JSON.parse(JSON.stringify(state)) as VacationStoreState;

const sameEmployeeName = (a?: string | null, b?: string | null): boolean =>
  Boolean(a && b) && employeeNamesMatch(a!, b!);

const SELF_VACATION_OVERLAP_MESSAGE = 'На эти даты уже есть отпуск.';

/** Своя заявка: сначала employee_id, иначе ФИО (legacy). */
const isSessionOwnRequest = (
  sessionEmployee: { id?: number | null; name?: string | null } | null | undefined,
  request: { employee: string; employee_id?: number | null }
): boolean => {
  if (!sessionEmployee) return false;
  const sid = Number(sessionEmployee.id);
  const rid = Number(request.employee_id);
  if (Number.isFinite(sid) && sid > 0 && Number.isFinite(rid) && rid > 0) {
    return sid === rid;
  }
  return sameEmployeeName(sessionEmployee.name, request.employee);
};

/** Два отпуска одного сотрудника (pending/approved) не должны пересекаться по датам. */
const assertSelfVacationOverlap = (
  state: VacationStoreState,
  employee: { id?: number | null; name: string },
  start: string,
  end: string,
  excludeRequestId?: number
) => {
  const allRequests = Object.values(state.requestsByYear).flat();
  const conflict = allRequests.some(
    (other) =>
      other.id !== excludeRequestId &&
      (other.status === 'approved' || other.status === 'pending') &&
      vacationBelongsToEmployee(other, employee) &&
      vacationRangesOverlap(start, end, other.start, other.end)
  );
  if (conflict) {
    throw createError({
      statusCode: 409,
      statusMessage: SELF_VACATION_OVERLAP_MESSAGE
    });
  }
};

/** HR и админ ведут график за всех: подают, правят и согласовывают заявки любого сотрудника. */
const hasRosterWideRights = (session: SessionUser): boolean =>
  session.role === 'admin' || session.role === 'hr';

/** Задним числом — только роль admin (не HR и не сотрудник). */
const canCreatePastVacation = (session: SessionUser): boolean => session.role === 'admin';

const assertStartNotInPastUnlessAdmin = (session: SessionUser, start: string) => {
  if (canCreatePastVacation(session)) return;
  if (isVacationStartInPast(start, todayIso())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Нельзя оформить отпуск задним числом — доступно только администратору'
    });
  }
};

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
  const canonicalName = employee?.name?.trim() || employeeName;

  const request: VacationRequest = {
    id: 0,
    employee: canonicalName,
    employee_id: employee?.id ?? null,
    start: body.start,
    end: body.end,
    status: 'pending',
    approval_step: employee ? initialApprovalStep(employee, canonicalName) : 'manager',
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
    assertBookableVacationYear(state.primaryYear, body.start, body.end);
    assertStartNotInPastUnlessAdmin(session, body.start);
    assertSelfVacationOverlap(
      state,
      { id: employee?.id ?? null, name: canonicalName },
      body.start,
      body.end
    );
    if (employee && session.role !== 'admin') {
      assertGroupLeadVacationOverlap(state, employee, body.start, body.end);
    }
    if (employee && session.role !== 'admin') {
      await assertVacationRequestGroupCap(state, canonicalName, body.start, body.end);
    }
    assertVacationBalanceSufficient(
      state,
      employee ? { ...employee, name: canonicalName } : null,
      body.start,
      body.end,
      isVacationShortfallBlocking({
        rosterWide: hasRosterWideRights(session),
        ownRequest:
          (Number(employee?.id) > 0 && employee?.id === sessionEmployee?.id) ||
          sameEmployeeName(canonicalName, sessionEmployee?.name)
      })
    );
    request.id = state.nextRequestId++;
    const list = state.requestsByYear[yearKey] ?? [];
    state.requestsByYear[yearKey] = [...list, request];
    createdRequest = { ...request };
    return state;
  }, { actorEmployeeId: sessionEmployee?.id ?? null, reason: 'api:request-create' });

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

    const owner =
      (found.item.employee_id
        ? (await readEmployees()).find((row) => row.id === found.item.employee_id)
        : null) ?? (await findEmployeeByName(found.item.employee));
    const isOwnRequest = isSessionOwnRequest(sessionEmployee, found.item);

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

      const roster = await readEmployees();
      const resolvePersonId = (name: string) =>
        roster.find((row) => employeeNamesMatch(row.name, name))?.id ?? null;
      const canReview =
        Boolean(owner) &&
        canApproverReviewRequest(
          { id: sessionEmployee?.id ?? null, name: sessionEmployee?.name?.trim() || '' },
          found.item,
          owner as VacationEmployeeRef,
          resolvePersonId
        );
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

    // HR/админ не откатывают согласованную заявку в pending через старую вкладку
    // одним только status=pending (без смены дат). Смена дат сотрудником — ниже.
    if (changesDecision && elevated && patch.status === 'pending' && found.item.status !== 'pending') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Нельзя вернуть обработанную заявку в «на согласовании»'
      });
    }

    previousRequest = { ...found.item };

    if (changesDates) {
      const nextStart = patch.start ?? found.item.start;
      assertStartNotInPastUnlessAdmin(session, nextStart);
    }

    const prevStart = found.item.start;
    const prevEnd = found.item.end;
    if (patch.start !== undefined) found.item.start = patch.start;
    if (patch.end !== undefined) found.item.end = patch.end;

    if (patch.start !== undefined || patch.end !== undefined) {
      yearFromIsoDate(found.item.end);
      const startYear = yearFromIsoDate(found.item.start);
      if (found.item.start !== prevStart || found.item.end !== prevEnd) {
        assertBookableVacationYear(state.primaryYear, found.item.start, found.item.end, prevStart);
      }
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

    if (changesDates) {
      assertSelfVacationOverlap(
        state,
        {
          id: owner?.id ?? found.item.employee_id ?? null,
          name: owner?.name?.trim() || found.item.employee
        },
        found.item.start,
        found.item.end,
        found.item.id
      );
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

    if (changesDates && (found.item.start !== prevStart || found.item.end !== prevEnd)) {
      assertVacationBalanceSufficient(
        state,
        owner ? { ...owner, name: owner.name?.trim() || found.item.employee } : null,
        found.item.start,
        found.item.end,
        isVacationShortfallBlocking({ rosterWide: elevated, ownRequest: isOwnRequest }),
        found.item.id
      );
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

    // Сотрудник поменял даты → заявка снова на согласование руководителю (рыжий pending),
    // даже если раньше уже была approved. HR/админ при правке чужих дат статус не трогаем.
    if (changesDates && !decision && !elevated && previousRequest) {
      const datesActuallyChanged =
        found.item.start !== previousRequest.start || found.item.end !== previousRequest.end;
      if (
        datesActuallyChanged &&
        (previousRequest.status === 'approved' || previousRequest.status === 'pending')
      ) {
        found.item.status = 'pending';
        found.item.approval_step = owner
          ? initialApprovalStep(owner as VacationEmployeeRef, found.item.employee)
          : 'manager';
      }
    }

    nextRequest = { ...found.item };
    return syncApprovedVacationsToBitrix(previous, state);
  }, { actorEmployeeId: sessionEmployee?.id ?? null, reason: 'api:request-patch' });

  // Сняли согласование (reject или смена дат → снова pending) — пальму в Bitrix убираем.
  if (
    previousRequest &&
    nextRequest &&
    previousRequest.status === 'approved' &&
    (nextRequest.status === 'rejected' || nextRequest.status === 'pending') &&
    previousRequest.bitrix_absence_id
  ) {
    try {
      await removeVacationAbsenceFromBitrix(previousRequest);
      await mutateVacations((state) => {
        const found = findRequest(state, id);
        if (!found) return state;
        delete found.item.bitrix_absence_id;
        delete found.item.bitrix_absence_iblock_id;
        found.item.bitrix_sync_status = undefined;
        found.item.bitrix_sync_method = undefined;
        found.item.bitrix_synced_at = undefined;
        found.item.bitrix_sync_error = undefined;
        return state;
      }, { actorEmployeeId: sessionEmployee?.id ?? null, reason: 'bitrix-absence-removed' });
      if (nextRequest) {
        nextRequest = {
          ...nextRequest,
          bitrix_absence_id: undefined,
          bitrix_absence_iblock_id: undefined,
          bitrix_sync_status: undefined,
          bitrix_sync_method: undefined,
          bitrix_synced_at: undefined,
          bitrix_sync_error: undefined
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Стейдж/локалка: запись в Bitrix выключена — уже залогировано гвардом, алерт админу не нужен.
      if (!isBitrixWriteBlockedError(error)) {
        console.error(
          `[bitrix-vacation] remove on unapprove failed for request #${id}:`,
          message
        );
        try {
          const employee = await findEmployeeByName(previousRequest.employee);
          await createBitrixVacationSyncFailedNotification({
            employee_id: employee?.id ?? employee?.bitrix_user_id ?? employee?.platform_user_id ?? 0,
            employee_name: previousRequest.employee,
            bitrix_user_id: employee?.bitrix_user_id ?? undefined,
            request_id: previousRequest.id,
            start: previousRequest.start,
            end: previousRequest.end,
            error: `Не удалось снять отметку об отпуске в Bitrix при снятии согласования: ${message}`
          });
        } catch (notifyError) {
          console.error(
            '[bitrix-vacation] admin notify on unapprove failed:',
            notifyError instanceof Error ? notifyError.message : String(notifyError)
          );
        }
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
    if (!elevated && !isSessionOwnRequest(sessionEmployee, found.item)) {
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
  }, { actorEmployeeId: sessionEmployee?.id ?? null, reason: 'api:request-delete' });

  if (removedRequest) {
    const removed = removedRequest as VacationRequest;
    if (removed.bitrix_absence_id) {
      try {
        await removeVacationAbsenceFromBitrix(removed);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Стейдж/локалка: запись в Bitrix выключена — гвард уже залогировал, алерт админу не шлём.
        if (!isBitrixWriteBlockedError(error)) {
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
    }
    await notifyVacationRequestDeleted(removed);
  }

  return result;
}
