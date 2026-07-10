import type { VacationReservation } from '../../app/utils/vacationReservations';
import { formatReservationLabel } from '../../app/utils/vacationReservations';
import { findEmployeeByName, employeeNotificationUserId } from './employeesStore';
import { createUserNotification } from './userNotificationsStore';

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const userIdForEmployeeName = async (name: string): Promise<number | null> => {
  const emp = await findEmployeeByName(name);
  if (!emp) return null;
  return employeeNotificationUserId(emp);
};

const monthBoundsIso = (year: number, month: number) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`
  };
};

/** Последний день месяца с бронью → сотруднику и руководителю. */
export async function notifyVacationReservationExpiring(reservation: VacationReservation) {
  const employee = await findEmployeeByName(reservation.employee);
  if (!employee) return;

  const { start, end } = monthBoundsIso(reservation.year, reservation.month);
  const monthLabel = MONTHS_RU[reservation.month - 1] ?? String(reservation.month);
  const durationLabel = formatReservationLabel(reservation.durationDays);
  const stageLabel = `${monthLabel} ${reservation.year}, ${durationLabel}`;

  const employeeId = await userIdForEmployeeName(reservation.employee);
  if (employeeId) {
    await createUserNotification({
      kind: 'vacation_reservation_expiring',
      recipient_user_id: employeeId,
      vacation_request_id: reservation.id,
      employee_name: reservation.employee,
      start,
      end,
      stage_label: stageLabel
    });
  }

  const managerName = employee.manager.trim();
  if (!managerName) return;

  const managerId = await userIdForEmployeeName(managerName);
  if (!managerId) return;

  await createUserNotification({
    kind: 'vacation_reservation_expiring_manager',
    recipient_user_id: managerId,
    vacation_request_id: reservation.id,
    employee_name: reservation.employee,
    start,
    end,
    stage_label: stageLabel
  });
}

/** Сотрудник изменил бронь → руководителю из справочника. */
export async function notifyVacationReservationUpdated(reservation: VacationReservation) {
  const employee = await findEmployeeByName(reservation.employee);
  if (!employee) return;

  const managerName = employee.manager.trim();
  if (!managerName) return;

  const recipientId = await userIdForEmployeeName(managerName);
  if (!recipientId) return;

  const { start, end } = monthBoundsIso(reservation.year, reservation.month);
  const monthLabel = MONTHS_RU[reservation.month - 1] ?? String(reservation.month);
  const durationLabel = formatReservationLabel(reservation.durationDays);

  await createUserNotification({
    kind: 'vacation_reservation_updated',
    recipient_user_id: recipientId,
    vacation_request_id: reservation.id,
    employee_name: reservation.employee,
    start,
    end,
    stage_label: `${monthLabel} ${reservation.year}, ${durationLabel}`
  });
}
