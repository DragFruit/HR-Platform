import { employeeNamesMatch } from '~/utils/employeeName';

/** Заявка или бронь — привязка к сотруднику. */
export type VacationEmployeeRef = {
  employee: string;
  /** id из справочника employees.json — стабильный ключ. */
  employee_id?: number | null;
};

export type EmployeeIdName = {
  id?: number | null;
  name?: string | null;
  /** совместимость с другой заявкой/бронью */
  employee_id?: number | null;
  employee?: string | null;
};

const refId = (emp: EmployeeIdName): number | null => {
  const raw = emp.employee_id ?? emp.id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const refName = (emp: EmployeeIdName): string =>
  String(emp.name ?? emp.employee ?? '').trim();

/**
 * Принадлежит ли заявка/бронь сотруднику.
 * Сначала по `employee_id` (не меняется при правке ФИО), иначе по ФИО (legacy).
 */
export const vacationBelongsToEmployee = (
  row: VacationEmployeeRef,
  emp: EmployeeIdName | string | null | undefined
): boolean => {
  if (!emp) return false;
  if (typeof emp === 'string') {
    return employeeNamesMatch(row.employee, emp);
  }
  // У заявки/брони свой `id` (номер заявки) — его нельзя путать с id сотрудника:
  // legacy-строка без employee_id сравнивается по ФИО.
  const rowId = refId({ employee_id: row.employee_id });
  const empId = refId(emp);
  if (rowId != null && empId != null) {
    return rowId === empId;
  }
  return employeeNamesMatch(row.employee, refName(emp));
};
