import type { VacationReservation } from '../../app/utils/vacationReservations';
import {
  canAddReservationForMonth,
  canManageReservationMonth,
  isValidReservationDuration
} from '../../app/utils/vacationReservations';
import type { SessionUser } from './credentials';
import { findEmployeeForSession } from './employeesStore';
import { notifyVacationReservationUpdated } from './vacationReservationNotifications';
import { mutateVacations, type VacationStoreState } from './vacationsStore';

const findReservation = (state: VacationStoreState, id: number) => {
  for (const [yearKey, list] of Object.entries(state.reservationsByYear)) {
    const index = list.findIndex((item) => item.id === id);
    if (index !== -1) return { yearKey, list, index, item: list[index]! };
  }
  return null;
};

const hasReservationConflict = (
  state: VacationStoreState,
  yearKey: string,
  employee: string,
  month: number,
  excludeId?: number
) => {
  const list = state.reservationsByYear[yearKey] ?? [];
  return list.some(
    (item) =>
      item.id !== excludeId &&
      item.employee.trim().toLowerCase() === employee.trim().toLowerCase() &&
      item.month === month
  );
};

export type CreateVacationReservationBody = {
  year: number;
  month: number;
  durationDays: number;
  employee?: string;
  comment?: string;
};

export async function createVacationReservation(
  session: SessionUser,
  body: CreateVacationReservationBody
): Promise<VacationStoreState> {
  const sessionEmployee = await findEmployeeForSession(session);
  const employeeName = body.employee?.trim() || sessionEmployee?.name?.trim() || '';

  if (!employeeName) {
    throw createError({ statusCode: 400, statusMessage: 'Не удалось определить сотрудника' });
  }

  if (
    body.employee?.trim() &&
    sessionEmployee?.name?.trim() &&
    body.employee.trim().toLowerCase() !== sessionEmployee.name.trim().toLowerCase() &&
    session.role !== 'admin'
  ) {
    throw createError({ statusCode: 403, statusMessage: 'Нельзя создать бронь за другого сотрудника' });
  }

  if (!Number.isInteger(body.month) || body.month < 1 || body.month > 12) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный месяц' });
  }

  if (!isValidReservationDuration(body.durationDays)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Длительность должна быть от 1 до 28 дней'
    });
  }

  if (!canAddReservationForMonth(body.year, body.month)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Нельзя поставить бронь на этот месяц'
    });
  }

  const yearKey = String(body.year);

  return mutateVacations((state) => {
    if (hasReservationConflict(state, yearKey, employeeName, body.month)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'В этом месяце уже есть предварительная бронь'
      });
    }

    const reservation: VacationReservation = {
      id: state.nextReservationId++,
      employee: employeeName,
      year: body.year,
      month: body.month,
      durationDays: body.durationDays,
      comment: body.comment?.trim() || undefined,
      createdAt: new Date().toLocaleDateString('ru-RU')
    };

    const list = state.reservationsByYear[yearKey] ?? [];
    state.reservationsByYear[yearKey] = [...list, reservation];
    return state;
  });
}

export type PatchVacationReservationBody = {
  durationDays?: number;
  comment?: string;
};

export async function patchVacationReservation(
  session: SessionUser,
  id: number,
  patch: PatchVacationReservationBody
): Promise<VacationStoreState> {
  const sessionEmployee = await findEmployeeForSession(session);

  if (patch.durationDays !== undefined && !isValidReservationDuration(patch.durationDays)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Длительность должна быть от 1 до 28 дней'
    });
  }

  let previousReservation: VacationReservation | null = null;
  let nextReservation: VacationReservation | null = null;

  const result = await mutateVacations((state) => {
    const found = findReservation(state, id);
    if (!found) {
      throw createError({ statusCode: 404, statusMessage: 'Бронь не найдена' });
    }

    const isOwner =
      sessionEmployee?.name?.trim().toLowerCase() === found.item.employee.trim().toLowerCase();
    if (!isOwner && session.role !== 'admin') {
      throw createError({ statusCode: 403, statusMessage: 'Нет прав изменить эту бронь' });
    }

    if (!canManageReservationMonth(found.item.year, found.item.month)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Бронь этого месяца больше нельзя изменить'
      });
    }

    previousReservation = { ...found.item };

    if (patch.durationDays !== undefined) {
      found.item.durationDays = patch.durationDays;
    }
    if (patch.comment !== undefined) {
      const trimmed = patch.comment.trim();
      if (trimmed) found.item.comment = trimmed;
      else delete found.item.comment;
    }

    nextReservation = { ...found.item };
    return state;
  });

  if (previousReservation && nextReservation) {
    const prev = previousReservation;
    const next = nextReservation;
    const durationChanged = prev.durationDays !== next.durationDays;
    const commentChanged = (prev.comment ?? '') !== (next.comment ?? '');
    if (durationChanged || commentChanged) {
      await notifyVacationReservationUpdated(next);
    }
  }

  return result;
}

export async function deleteVacationReservation(
  session: SessionUser,
  id: number
): Promise<VacationStoreState> {
  const sessionEmployee = await findEmployeeForSession(session);

  return mutateVacations((state) => {
    const found = findReservation(state, id);
    if (!found) {
      throw createError({ statusCode: 404, statusMessage: 'Бронь не найдена' });
    }

    const isOwner =
      sessionEmployee?.name?.trim().toLowerCase() === found.item.employee.trim().toLowerCase();
    if (!isOwner && session.role !== 'admin') {
      throw createError({ statusCode: 403, statusMessage: 'Нет прав удалить эту бронь' });
    }

    if (!canManageReservationMonth(found.item.year, found.item.month)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Бронь этого месяца больше нельзя удалить'
      });
    }

    state.reservationsByYear[found.yearKey] = found.list.filter((item) => item.id !== id);
    return state;
  });
}
