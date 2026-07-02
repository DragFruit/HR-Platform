import { calcAvailableOnDate } from '../../app/utils/vacationBalance';
import type { VacationRequest } from '../../app/composables/useVacations';
import type { ServerEmployee } from './employeesStore';
import type { VacationStoreState } from './vacationsStore';

export type YearRolloverEmployeeUpdate = {
  id: number;
  name: string;
  fromOpening: number | null;
  toOpening: number;
};

export type YearRolloverResult = {
  employees: ServerEmployee[];
  vacations: VacationStoreState;
  updates: YearRolloverEmployeeUpdate[];
  skipped: string[];
};

/** Все заявки с годом бакета ≤ throughYear (для расчёта остатка на 31.12). */
export function requestsThroughYear(
  state: VacationStoreState,
  throughYear: number
): VacationRequest[] {
  return Object.entries(state.requestsByYear)
    .filter(([yearKey]) => {
      const y = Number(yearKey);
      return !Number.isNaN(y) && y <= throughYear;
    })
    .flatMap(([, list]) => list);
}

/** Остаток на конец учётного года (31.12) — то, что переносим на 01.01 следующего года. */
export function closingBalanceOnYearEnd(
  emp: Pick<ServerEmployee, 'name' | 'hired_at' | 'vacation_opening_balance'>,
  fromYear: number,
  requests: VacationRequest[]
): number | null {
  const hire = emp.hired_at?.trim();
  if (!hire) return null;

  const asOfIso = `${fromYear}-12-31`;
  const hireYear = Number(hire.slice(0, 4));
  if (!Number.isNaN(hireYear) && hireYear > fromYear) return 0;

  return calcAvailableOnDate(
    emp.name,
    hire,
    asOfIso,
    requests,
    fromYear,
    emp.vacation_opening_balance
  );
}

/**
 * Переход учётного года: остаток на 31.12.fromYear → vacation_opening_balance на 01.01.toYear.
 * primaryYear в vacations обновляется на toYear.
 */
export function applyVacationYearRollover(
  employees: ServerEmployee[],
  vacations: VacationStoreState,
  fromYear: number,
  toYear: number
): YearRolloverResult {
  if (toYear !== fromYear + 1) {
    throw new Error(`Ожидается toYear = fromYear + 1 (получено ${fromYear} → ${toYear})`);
  }

  const requests = requestsThroughYear(vacations, fromYear);
  const updates: YearRolloverEmployeeUpdate[] = [];
  const skipped: string[] = [];

  const nextEmployees = employees.map((emp) => {
    const closing = closingBalanceOnYearEnd(emp, fromYear, requests);
    if (closing === null) {
      skipped.push(emp.name);
      return emp;
    }

    const rounded = Math.floor(closing * 10) / 10;
    updates.push({
      id: emp.id,
      name: emp.name,
      fromOpening: emp.vacation_opening_balance ?? null,
      toOpening: rounded
    });

    return {
      ...emp,
      vacation_opening_balance: rounded
    };
  });

  const nextVacations: VacationStoreState = {
    ...vacations,
    primaryYear: toYear,
    requestsByYear: {
      ...vacations.requestsByYear,
      [String(toYear)]: vacations.requestsByYear[String(toYear)] ?? []
    }
  };

  return {
    employees: nextEmployees,
    vacations: nextVacations,
    updates,
    skipped
  };
}
