import type { VacationRequest } from '~/composables/useVacations';
import type { VacationReservation } from '~/utils/vacationReservations';
import {
  QA_EMPLOYEE_ALINA_NAME,
  QA_EMPLOYEE_DASHA_NAME,
  QA_EMPLOYEE_MARINA_NAME,
  QA_EMPLOYEE_VASILY_NAME,
  QA_TEAM_LEAD_NAME,
  isQaTestDepartmentEnabledFromEnv
} from '~/data/qaTestDepartment';

/** Фиксированные id — не пересекаются с боевыми заявками и не пишутся в vacations.json. */
export const QA_VACATION_REQUEST_IDS = new Set([9101, 9102, 9103, 9104, 9105, 9106, 9107]);
/** Отдельный диапазон id для броней — не пересекается с id заявок (иначе удаление «мигает»). */
export const QA_VACATION_RESERVATION_IDS = new Set([9201, 9202, 9203]);

/** Убрать только демо-seed из файла перед записью; пользовательские заявки QA-сотрудников сохраняем. */
export function stripQaTestVacationRequests<T extends { id: number }>(rows: T[]): T[] {
  return rows.filter((row) => !QA_VACATION_REQUEST_IDS.has(row.id));
}

/** Убрать только демо-seed из файла перед записью; пользовательские брони QA-сотрудников сохраняем. */
export function stripQaTestVacationReservations<T extends { id: number }>(rows: T[]): T[] {
  return rows.filter((row) => !QA_VACATION_RESERVATION_IDS.has(row.id));
}

export type QaDemoVacationSuppressed = {
  requestIds: number[];
  reservationIds: number[];
};

export const emptyQaDemoVacationSuppressed = (): QaDemoVacationSuppressed => ({
  requestIds: [],
  reservationIds: []
});

/** Запомнить удаление демо-записи, чтобы merge при следующем чтении не вернул её из seed. */
export function recordQaDemoVacationDeletion(
  suppressed: QaDemoVacationSuppressed | undefined,
  kind: 'request' | 'reservation',
  id: number
): QaDemoVacationSuppressed {
  const isQa =
    kind === 'request' ? QA_VACATION_REQUEST_IDS.has(id) : QA_VACATION_RESERVATION_IDS.has(id);
  if (!isQa) return suppressed ?? emptyQaDemoVacationSuppressed();

  const base = suppressed ?? emptyQaDemoVacationSuppressed();
  const key = kind === 'request' ? 'requestIds' : 'reservationIds';
  if (base[key].includes(id)) return base;
  return { ...base, [key]: [...base[key], id] };
}

function applyQaDemoSuppressedToSeed(
  requests: VacationRequest[],
  reservations: VacationReservation[],
  suppressed?: QaDemoVacationSuppressed
) {
  if (!suppressed) return { requests, reservations };
  const reqHidden = new Set(suppressed.requestIds);
  const resHidden = new Set(suppressed.reservationIds);
  return {
    requests: requests.filter((row) => !reqHidden.has(row.id)),
    reservations: reservations.filter((row) => !resHidden.has(row.id))
  };
}

const QA_YEAR = 2026;

export function buildQaTestVacationRequests(): VacationRequest[] {
  return [
    {
      id: 9101,
      employee: QA_EMPLOYEE_DASHA_NAME,
      start: '2026-07-14',
      end: '2026-07-25',
      status: 'approved',
      comment: 'Демо: одобренный отпуск',
      createdAt: '01.07.2026'
    },
    {
      id: 9102,
      employee: QA_EMPLOYEE_VASILY_NAME,
      start: '2026-08-03',
      end: '2026-08-14',
      status: 'approved',
      comment: 'Демо: одобренный отпуск',
      createdAt: '02.07.2026'
    },
    {
      id: 9103,
      employee: QA_EMPLOYEE_ALINA_NAME,
      start: '2026-09-08',
      end: '2026-09-19',
      status: 'pending',
      approval_step: 'manager',
      comment: 'Демо: на согласовании у тимлида',
      createdAt: '03.07.2026'
    },
    {
      id: 9104,
      employee: QA_EMPLOYEE_MARINA_NAME,
      start: '2026-09-15',
      end: '2026-09-26',
      status: 'approved',
      comment: 'Демо: пересечение с Алиной',
      createdAt: '03.07.2026'
    },
    {
      id: 9105,
      employee: QA_EMPLOYEE_DASHA_NAME,
      start: '2026-11-16',
      end: '2026-11-22',
      status: 'approved',
      comment: 'Демо: одобренный отпуск',
      createdAt: '04.07.2026'
    },
    {
      id: 9106,
      employee: QA_EMPLOYEE_DASHA_NAME,
      start: '2026-12-07',
      end: '2026-12-13',
      status: 'pending',
      approval_step: 'director',
      comment: 'Демо: второй этап — директор',
      createdAt: '05.07.2026'
    },
    {
      id: 9107,
      employee: QA_TEAM_LEAD_NAME,
      start: '2026-10-20',
      end: '2026-10-24',
      status: 'approved',
      comment: 'Демо: отпуск руководителя',
      createdAt: '06.07.2026'
    }
  ];
}

export function buildQaTestVacationReservations(): VacationReservation[] {
  return [
    {
      id: 9201,
      employee: QA_EMPLOYEE_DASHA_NAME,
      year: QA_YEAR,
      month: 10,
      durationDays: 7,
      comment: 'Уточню даты позже',
      createdAt: '08.07.2026'
    },
    {
      id: 9202,
      employee: QA_EMPLOYEE_ALINA_NAME,
      year: QA_YEAR,
      month: 9,
      durationDays: 5,
      createdAt: '08.07.2026'
    },
    {
      id: 9203,
      employee: QA_EMPLOYEE_MARINA_NAME,
      year: QA_YEAR,
      month: 12,
      durationDays: 10,
      comment: 'Планирую в конце года',
      createdAt: '08.07.2026'
    }
  ];
}

export function mergeQaTestVacationState<
  T extends {
    requestsByYear: Record<string, VacationRequest[]>;
    reservationsByYear: Record<string, VacationReservation[]>;
    qaDemoSuppressed?: QaDemoVacationSuppressed;
  }
>(state: T): T {
  if (!isQaTestDepartmentEnabledFromEnv()) return state;

  const yearKey = String(QA_YEAR);
  const seed = applyQaDemoSuppressedToSeed(
    buildQaTestVacationRequests(),
    buildQaTestVacationReservations(),
    state.qaDemoSuppressed
  );
  const requests = stripQaTestVacationRequests(state.requestsByYear[yearKey] ?? []).concat(seed.requests);
  const reservations = stripQaTestVacationReservations(state.reservationsByYear[yearKey] ?? []).concat(
    seed.reservations
  );

  return {
    ...state,
    primaryYear: QA_YEAR,
    requestsByYear: {
      ...state.requestsByYear,
      [yearKey]: requests
    },
    reservationsByYear: {
      ...state.reservationsByYear,
      [yearKey]: reservations
    }
  };
}
