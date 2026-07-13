import type { Employee, EmployeeDepartment } from '~/composables/useEmployees';
import {
  QA_DIRECTOR_NAME,
  QA_TEAM_LEAD_NAME,
  QA_TEST_DEPARTMENT_NAME
} from '~/data/qaTestDepartment';
import {
  DIGITAL_DIRECTOR_NAME,
  isDigitalDepartment,
  isDigitalGroupLeadName
} from '~/utils/vacationApproval';

export type VacationGroupDef =
  | { id: string; label: string; type: 'explicit'; memberNames: readonly string[] }
  | { id: string; label: string; type: 'lead'; leadName: string };

type DepartmentVacationLayout = {
  department: string;
  directorName: string;
  directorGroupId: string;
  isGroupLead: (managerName: string) => boolean;
  groups: readonly VacationGroupDef[];
  fallbackBucketLabel: string;
  /** Общий пул лимита броней на месяц для всего отдела (иначе — по subgroup). */
  reservationCapPoolId?: string;
};

const DIGITAL_VACATION_GROUP_DEFS: readonly VacationGroupDef[] = [
  {
    id: 'digital-directorate',
    label: 'Digital / Дирекция',
    type: 'explicit',
    memberNames: ['Ревзина Ксения', 'Жукова Юлия']
  },
  {
    id: 'digital-gromov',
    label: 'Digital / SMM · Громов',
    type: 'explicit',
    memberNames: ['Громов Максим']
  },
  {
    id: 'digital-analytics',
    label: 'Digital / Analytics',
    type: 'explicit',
    memberNames: ['Левина Анастасия', 'Мощев Максим']
  },
  { id: 'digital-tskhai', label: 'Digital / Группа 3', type: 'lead', leadName: 'Цхай Виталий' },
  { id: 'digital-popov', label: 'Digital / Группа · Попов', type: 'lead', leadName: 'Попов Виктор' },
  { id: 'digital-lunin', label: 'Digital / Группа · Лунин', type: 'lead', leadName: 'Лунин Дмитрий' },
  { id: 'digital-noskov', label: 'Digital / SMM · Носков', type: 'lead', leadName: 'Носков Никита' }
];

const QA_VACATION_GROUP_DEFS: readonly VacationGroupDef[] = [
  {
    id: 'qa-directorate',
    label: 'Тестировщики / Дирекция',
    type: 'explicit',
    memberNames: [QA_DIRECTOR_NAME]
  },
  {
    id: 'qa-team',
    label: 'Тестировщики / Команда',
    type: 'lead',
    leadName: QA_TEAM_LEAD_NAME
  }
];

const DEPARTMENT_VACATION_LAYOUTS: readonly DepartmentVacationLayout[] = [
  {
    department: 'Digital',
    directorName: DIGITAL_DIRECTOR_NAME,
    directorGroupId: 'digital-directorate',
    isGroupLead: isDigitalGroupLeadName,
    groups: DIGITAL_VACATION_GROUP_DEFS,
    fallbackBucketLabel: 'Digital / Прочие',
    reservationCapPoolId: 'digital-department'
  },
  {
    department: QA_TEST_DEPARTMENT_NAME,
    directorName: QA_DIRECTOR_NAME,
    directorGroupId: 'qa-directorate',
    isGroupLead: (name) => name.trim() === QA_TEAM_LEAD_NAME,
    groups: QA_VACATION_GROUP_DEFS,
    fallbackBucketLabel: 'Тестировщики / Прочие',
    reservationCapPoolId: 'qa-department'
  }
];

export type VacationGroupHelpers = {
  directReports: (managerName: string) => Employee[];
  findByName: (name: string) => Employee | undefined;
  /** Все сотрудники отдела — для общего пула лимита броней. */
  employeesInDepartment?: (department: string) => Employee[];
};

const sortEmployees = (list: Employee[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

export function isGroupedVacationDepartment(department: string): boolean {
  const trimmed = department.trim();
  return DEPARTMENT_VACATION_LAYOUTS.some((layout) => layout.department === trimmed);
}

export function getVacationDepartmentLayout(department: string): DepartmentVacationLayout | null {
  return DEPARTMENT_VACATION_LAYOUTS.find((layout) => layout.department === department.trim()) ?? null;
}

export function findVacationGroupDefById(groupId: string): VacationGroupDef | null {
  for (const layout of DEPARTMENT_VACATION_LAYOUTS) {
    const found = layout.groups.find((group) => group.id === groupId);
    if (found) return found;
  }
  return null;
}

const resolveGroupMembers = (def: VacationGroupDef, helpers: VacationGroupHelpers): Employee[] => {
  if (def.type === 'explicit') {
    const members = def.memberNames
      .map((name) => helpers.findByName(name))
      .filter((row): row is Employee => Boolean(row));
    return sortEmployees(members);
  }

  const lead = helpers.findByName(def.leadName);
  if (!lead) return [];
  const reports = helpers.directReports(def.leadName);
  const seen = new Set<number>();
  const combined: Employee[] = [];
  for (const emp of [lead, ...reports]) {
    if (seen.has(emp.id)) continue;
    seen.add(emp.id);
    combined.push(emp);
  }
  return sortEmployees(combined);
};

export function resolveVacationDepartmentsForDepartment(
  department: string,
  allEmployees: Employee[],
  helpers: VacationGroupHelpers
): EmployeeDepartment[] {
  const layout = getVacationDepartmentLayout(department);
  if (!layout) return [];

  const departmentIds = new Set(
    allEmployees.filter((emp) => emp.department.trim() === layout.department).map((emp) => emp.id)
  );

  const departments = layout.groups
    .map((def) => ({
      name: def.label,
      employees: resolveGroupMembers(def, helpers)
    }))
    .filter((dep) => dep.employees.length > 0);

  const groupedIds = new Set(departments.flatMap((dep) => dep.employees.map((emp) => emp.id)));
  const ungrouped = allEmployees.filter(
    (emp) => departmentIds.has(emp.id) && !groupedIds.has(emp.id)
  );
  if (ungrouped.length) {
    departments.push({
      name: layout.fallbackBucketLabel,
      employees: sortEmployees(ungrouped)
    });
  }

  return departments;
}

const uniqueEmployees = (list: Employee[]) => {
  const seen = new Set<number>();
  const out: Employee[] = [];
  for (const emp of list) {
    if (seen.has(emp.id)) continue;
    seen.add(emp.id);
    out.push(emp);
  }
  return sortEmployees(out);
};

const resolveDepartmentCapMembers = (
  layout: DepartmentVacationLayout,
  helpers: VacationGroupHelpers
): Employee[] => {
  const fromDept = helpers.employeesInDepartment?.(layout.department);
  if (fromDept?.length) return fromDept;
  return uniqueEmployees(layout.groups.flatMap((def) => resolveGroupMembers(def, helpers)));
};

/** Пул отдела + подгруппа для двухуровневого лимита броней (5 на отдел, 1 в группе). */
export function resolveEmployeeReservationCapContext(
  employee: Pick<Employee, 'name' | 'department' | 'manager'> | null | undefined,
  helpers: VacationGroupHelpers
): {
  department: { id: string; label: string; members: Employee[] };
  subgroup: { id: string; label: string; members: Employee[] };
} | null {
  if (!employee?.name.trim()) return null;
  const layout = getVacationDepartmentLayout(employee.department);
  if (!layout?.reservationCapPoolId) return null;

  const subgroup = resolveVacationGroupForEmployee(employee, helpers);
  if (!subgroup) return null;

  const deptMembers = resolveDepartmentCapMembers(layout, helpers);
  if (!deptMembers.length) return null;

  return {
    department: {
      id: layout.reservationCapPoolId,
      label: layout.department,
      members: deptMembers
    },
    subgroup: {
      id: subgroup.id,
      label: subgroup.label,
      members: subgroup.members
    }
  };
}

/** @deprecated Используйте resolveEmployeeReservationCapContext */
export function resolveReservationCapGroupForEmployee(
  employee: Pick<Employee, 'name' | 'department' | 'manager'> | null | undefined,
  helpers: VacationGroupHelpers
): { id: string; label: string; members: Employee[] } | null {
  const ctx = resolveEmployeeReservationCapContext(employee, helpers);
  if (!ctx) return null;
  return {
    id: ctx.department.id,
    label: ctx.department.label,
    members: ctx.department.members
  };
}

export function resolveReservationCapGroupIdForManager(
  managerName: string,
  helpers: VacationGroupHelpers,
  department?: string
): string | null {
  const trimmed = managerName.trim();
  if (!trimmed) return null;

  const dept = department?.trim();
  if (dept) {
    const layout = getVacationDepartmentLayout(dept);
    if (layout?.reservationCapPoolId) {
      if (trimmed === layout.directorName || layout.isGroupLead(trimmed)) {
        return layout.reservationCapPoolId;
      }
      return null;
    }
  }

  return resolveVacationGroupIdForManager(trimmed, helpers, department);
}

export function resolveReservationCapGroupMeta(
  groupId: string
): { id: string; label: string } | null {
  for (const layout of DEPARTMENT_VACATION_LAYOUTS) {
    if (layout.reservationCapPoolId === groupId) {
      return { id: groupId, label: `${layout.department} — весь отдел` };
    }
  }
  const def = findVacationGroupDefById(groupId);
  return def ? { id: def.id, label: def.label } : null;
}

export function resolveVacationGroupForEmployee(
  employee: Pick<Employee, 'name' | 'department' | 'manager'> | null | undefined,
  helpers: VacationGroupHelpers
): { id: string; label: string; members: Employee[] } | null {
  if (!employee?.name.trim()) return null;
  const layout = getVacationDepartmentLayout(employee.department);
  if (!layout) return null;

  const name = employee.name.trim();
  for (const def of layout.groups) {
    const members = resolveGroupMembers(def, helpers);
    if (members.some((emp) => emp.name.trim() === name)) {
      return { id: def.id, label: def.label, members };
    }
  }
  return null;
}

export function resolveVacationGroupIdForManager(
  managerName: string,
  helpers: VacationGroupHelpers,
  department?: string
): string | null {
  const trimmed = managerName.trim();
  if (!trimmed) return null;

  const layouts = department
    ? DEPARTMENT_VACATION_LAYOUTS.filter((layout) => layout.department === department.trim())
    : DEPARTMENT_VACATION_LAYOUTS;

  for (const layout of layouts) {
    if (trimmed === layout.directorName) return layout.directorGroupId;

    const leadDef = layout.groups.find(
      (def) => def.type === 'lead' && def.leadName === trimmed
    );
    if (leadDef) return leadDef.id;

    if (layout.isGroupLead(trimmed)) {
      const surname = trimmed.split(/\s+/)[0] ?? '';
      const bySurname = layout.groups.find(
        (def) => def.type === 'lead' && def.leadName.startsWith(`${surname} `)
      );
      if (bySurname) return bySurname.id;
    }
  }

  return null;
}

export function isVacationDepartmentDirector(managerName: string, department: string): boolean {
  const layout = getVacationDepartmentLayout(department);
  return Boolean(layout && managerName.trim() === layout.directorName);
}

export function isVacationGroupLead(managerName: string, department: string): boolean {
  const layout = getVacationDepartmentLayout(department);
  return Boolean(layout && layout.isGroupLead(managerName.trim()));
}

/** Календарь руководителя: директор — все группы; тимлид — одна группа. */
export function resolveManagerCalendarDepartments(
  managerName: string,
  allEmployees: Employee[],
  helpers: VacationGroupHelpers
): EmployeeDepartment[] {
  const trimmed = managerName.trim();
  if (!trimmed) return [];

  const manager = helpers.findByName(trimmed);
  const department = manager?.department?.trim();
  if (!department) return [];

  const layout = getVacationDepartmentLayout(department);
  if (!layout) return [];

  if (trimmed === layout.directorName) {
    return resolveVacationDepartmentsForDepartment(department, allEmployees, helpers);
  }

  const groupId = resolveVacationGroupIdForManager(trimmed, helpers, department);
  if (!groupId) return [];

  const def = layout.groups.find((row) => row.id === groupId);
  if (!def) return [];

  const members = resolveGroupMembers(def, helpers);
  if (!members.length) return [];
  return [{ name: def.label, employees: members }];
}

/** @deprecated Используйте resolveVacationDepartmentsForDepartment('Digital', …) */
export const resolveDigitalVacationDepartments = (
  allEmployees: Employee[],
  helpers: VacationGroupHelpers
) => resolveVacationDepartmentsForDepartment('Digital', allEmployees, helpers);

/** @deprecated */
export const resolveDigitalGroupForEmployee = resolveVacationGroupForEmployee;

/** @deprecated */
export const resolveDigitalGroupIdForManager = (
  managerName: string,
  helpers: VacationGroupHelpers
) => resolveVacationGroupIdForManager(managerName, helpers, 'Digital');

/** @deprecated */
export const resolveDigitalManagerCalendarDepartments = resolveManagerCalendarDepartments;

export const DIGITAL_VACATION_GROUP_DEFS_EXPORT = DIGITAL_VACATION_GROUP_DEFS;
