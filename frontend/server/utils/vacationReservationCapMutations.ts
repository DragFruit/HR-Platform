import {
  resolveEmployeeReservationCapContext,
  resolveReservationCapGroupIdForManager
} from '../../app/utils/vacationDepartmentGroups';
import type { ReservationMonthlyCapsByGroup } from '../../app/utils/vacationReservationCaps';
import {
  getReservationMonthBlockReason,
  reservationCapBlockMessage
} from '../../app/utils/vacationReservationCaps';
import type { SessionUser } from './credentials';
import { findEmployeeByName, findEmployeeForSession, readEmployees } from './employeesStore';
import { mutateVacations, type VacationStoreState } from './vacationsStore';

const buildGroupHelpers = async () => {
  const allEmployees = await readEmployees();
  return {
    allEmployees,
    directReports: (managerName: string) =>
      allEmployees.filter((emp) => emp.manager.trim() === managerName.trim()),
    findByName: (name: string) => allEmployees.find((emp) => emp.name.trim() === name.trim()),
    employeesInDepartment: (department: string) =>
      allEmployees.filter((emp) => emp.department.trim() === department.trim())
  };
};

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

  const yearKey = String(year);
  const reservations = state.reservationsByYear[yearKey] ?? [];
  const caps = state.reservationMonthlyCapsByGroup;

  const capContext = {
    department: {
      id: context.department.id,
      label: context.department.label,
      memberNames: context.department.members.map((emp) => emp.name)
    },
    subgroup: {
      id: context.subgroup.id,
      label: context.subgroup.label,
      memberNames: context.subgroup.members.map((emp) => emp.name)
    }
  };

  const reason = getReservationMonthBlockReason({
    context: capContext,
    year,
    month,
    reservations,
    caps,
    excludeEmployee: employeeName
  });

  if (reason) {
    throw createError({
      statusCode: 409,
      statusMessage: reservationCapBlockMessage(reason)
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
  });
}
