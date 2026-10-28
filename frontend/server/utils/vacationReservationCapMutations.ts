import { employeeNamesMatch } from '../../app/utils/employeeName';
import {
  resolveEmployeeReservationCapContext,
  resolveReservationCapGroupIdForManager
} from '../../app/utils/vacationDepartmentGroups';
import type { ReservationMonthlyCapsByGroup } from '../../app/utils/vacationReservationCaps';
import {
  getReservationMonthBlockReason,
  getReservationRangeBlockReason,
  reservationCapBlockMessage,
  toEmployeeReservationCapContext,
  vacationRequestCapBlockMessage,
  type EmployeeReservationCapContext
} from '../../app/utils/vacationReservationCaps';
import type { SessionUser } from './credentials';
import { findEmployeeByName, findEmployeeForSession, readEmployees } from './employeesStore';
import { mutateVacations, type VacationStoreState } from './vacationsStore';
import { readOrgStructure } from './orgStructureStore';

const buildGroupHelpers = async () => {
  const allEmployees = await readEmployees();
  // Группы Digital для лимита «1 на группу» — из оргструктуры (та же функция, что на клиенте).
  const orgStructure = await readOrgStructure().catch((error) => {
    console.warn('[vacations] не удалось прочитать оргструктуру для лимитов:', error);
    return null;
  });
  return {
    allEmployees,
    orgStructure,
    directReports: (managerRef: string | number) => {
      const managerId =
        typeof managerRef === 'number'
          ? managerRef
          : allEmployees.find((emp) => employeeNamesMatch(emp.name, managerRef))?.id;
      if (!managerId) return [];
      return allEmployees.filter((emp) => emp.manager_id === managerId && emp.id !== managerId);
    },
    findByName: (name: string) =>
      allEmployees.find((emp) => employeeNamesMatch(emp.name, name)),
    employeesInDepartment: (department: string) =>
      allEmployees.filter((emp) => emp.department.trim() === department.trim())
  };
};

const toCapContext = (
  context: NonNullable<ReturnType<typeof resolveEmployeeReservationCapContext>>
): EmployeeReservationCapContext => toEmployeeReservationCapContext(context);

const allReservations = (state: VacationStoreState) =>
  Object.values(state.reservationsByYear).flat();

const allRequests = (state: VacationStoreState) => Object.values(state.requestsByYear).flat();

export async function assertReservationGroupCap(
  state: VacationStoreState,
  employeeName: string,
  year: number,
  month: number
) {
  const employee = await findEmployeeByName(employeeName);
  if (!employee) return;

  const helpers = await buildGroupHelpers();
  const context = resolveEmployeeReservationCapContext(employee, helpers);
  if (!context) return;

  const reason = getReservationMonthBlockReason({
    context: toCapContext(context),
    year,
    month,
    reservations: allReservations(state),
    requests: allRequests(state),
    caps: state.reservationMonthlyCapsByGroup,
    excludeEmployee: employeeName
  });

  if (reason) {
    throw createError({
      statusCode: 409,
      statusMessage: reservationCapBlockMessage(reason)
    });
  }
}

/** Лимит группы/отдела при подаче или сдвиге заявки с датами: по реальному пересечению дней. */
export async function assertVacationRequestGroupCap(
  state: VacationStoreState,
  employeeName: string,
  start: string,
  end: string
) {
  const employee = await findEmployeeByName(employeeName);
  if (!employee) return;

  const helpers = await buildGroupHelpers();
  const context = resolveEmployeeReservationCapContext(employee, helpers);
  if (!context) return;

  const capContext = toCapContext(context);
  const reason = getReservationRangeBlockReason({
    context: capContext,
    start,
    end,
    reservations: allReservations(state),
    requests: allRequests(state),
    caps: state.reservationMonthlyCapsByGroup,
    excludeEmployee: employeeName
  });

  if (reason) {
    throw createError({
      statusCode: 409,
      statusMessage: vacationRequestCapBlockMessage(reason, capContext, state.reservationMonthlyCapsByGroup)
    });
  }
}

export type PatchReservationMonthlyCapBody = {
  groupId: string;
  cap: number;
};

export async function patchReservationMonthlyCap(
  session: SessionUser,
  body: PatchReservationMonthlyCapBody
): Promise<VacationStoreState> {
  const groupId = body.groupId?.trim();
  const cap = Number(body.cap);

  if (!groupId) {
    throw createError({ statusCode: 400, statusMessage: 'Не указана группа' });
  }
  if (!Number.isFinite(cap) || cap < 1 || cap > 99) {
    throw createError({ statusCode: 400, statusMessage: 'Лимит должен быть от 1 до 99' });
  }

  const sessionEmployee = await findEmployeeForSession(session);
  const managerName = sessionEmployee?.name?.trim() ?? '';
  const department = sessionEmployee?.department?.trim();
  if (!managerName && session.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Нет прав изменить лимит' });
  }

  const helpers = await buildGroupHelpers();
  const allowedGroupId =
    session.role === 'admin'
      ? groupId
      : department
        ? resolveReservationCapGroupIdForManager(managerName, helpers, department)
        : resolveReservationCapGroupIdForManager(managerName, helpers);

  if (!allowedGroupId || allowedGroupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: 'Нет прав изменить лимит этой группы' });
  }

  return mutateVacations((state) => {
    const nextCaps: ReservationMonthlyCapsByGroup = {
      ...(state.reservationMonthlyCapsByGroup ?? {}),
      [groupId]: Math.floor(cap)
    };
    state.reservationMonthlyCapsByGroup = nextCaps;
    return state;
  }, { actorEmployeeId: sessionEmployee?.id ?? null, reason: 'api:reservation-cap' });
}
