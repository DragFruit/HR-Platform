import { employeeNamesMatch } from './employeeName';

/** Минимальные поля для резолва руководителя. */
export type EmployeeManagerFields = {
  id: number;
  name: string;
  manager?: string | null;
  manager_id?: number | null;
};

/**
 * Проставить `manager_id` по ФИО руководителя (legacy), если id ещё нет.
 * Иерархия дальше должна идти только по `manager_id`.
 */
export const ensureEmployeeManagerIds = <T extends EmployeeManagerFields>(list: T[]): T[] => {
  const byId = new Map(list.map((emp) => [emp.id, emp]));

  return list.map((emp) => {
    const existing = Number(emp.manager_id);
    if (Number.isFinite(existing) && existing > 0 && byId.has(existing) && existing !== emp.id) {
      return emp.manager_id === existing ? emp : { ...emp, manager_id: existing };
    }

    const managerName = String(emp.manager || '').trim();
    if (!managerName) {
      return emp.manager_id == null ? emp : { ...emp, manager_id: null };
    }

    const manager = list.find(
      (row) => row.id !== emp.id && employeeNamesMatch(row.name, managerName)
    );
    const nextId = manager?.id ?? null;
    if (emp.manager_id === nextId) return emp;
    return { ...emp, manager_id: nextId };
  });
};

/** id руководителя: из `manager_id`, иначе резолв по ФИО в списке. */
export const resolveManagerId = (
  emp: EmployeeManagerFields | null | undefined,
  list: EmployeeManagerFields[]
): number | null => {
  if (!emp) return null;
  const existing = Number(emp.manager_id);
  if (Number.isFinite(existing) && existing > 0 && existing !== emp.id) {
    if (list.some((row) => row.id === existing)) return existing;
  }
  const managerName = String(emp.manager || '').trim();
  if (!managerName) return null;
  const manager = list.find(
    (row) => row.id !== emp.id && employeeNamesMatch(row.name, managerName)
  );
  return manager?.id ?? null;
};

export const employeeRefId = (
  emp: { id?: number | null; employee_id?: number | null } | number | null | undefined
): number | null => {
  if (emp == null) return null;
  if (typeof emp === 'number') {
    return Number.isFinite(emp) && emp > 0 ? emp : null;
  }
  const raw = emp.employee_id ?? emp.id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};
