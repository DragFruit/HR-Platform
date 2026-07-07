import type { Employee } from '~/composables/useEmployees';
import {
  DIGITAL_DIRECTOR_NAME,
  isDigitalDepartment,
  isDigitalGroupLeadName
} from '~/utils/vacationApproval';

export type VacationTeamScopeKind = 'digital-department' | 'digital-group' | 'department';

export type VacationTeamScope = {
  kind: VacationTeamScopeKind;
  label: string;
  members: Employee[];
};

type ScopeHelpers = {
  employeesInDepartment: (department: string) => Employee[];
  directReports: (managerName: string) => Employee[];
  findByName: (name: string) => Employee | undefined;
};

const sortMembers = (list: Employee[]) => {
  const seen = new Set<number>();
  const unique: Employee[] = [];
  for (const emp of list) {
    if (!emp.name.trim() || seen.has(emp.id)) continue;
    seen.add(emp.id);
    unique.push(emp);
  }
  return unique.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
};

const groupLeadLabel = (leadName: string) => {
  const short = leadName.trim().split(/\s+/)[0] ?? leadName.trim();
  return `Digital · ${short}`;
};

/**
 * Общий календарь отпусков для сотрудника:
 * - Digital: группа групхеда (или весь Digital для директора);
 * - остальные отделы: все сотрудники отдела, включая руководителей.
 */
export function resolveVacationTeamScope(
  viewer: Employee | null | undefined,
  allEmployees: Employee[],
  helpers: ScopeHelpers
): VacationTeamScope | null {
  if (!viewer?.name.trim()) return null;

  const department = viewer.department.trim();
  const viewerName = viewer.name.trim();
  if (!department) return null;

  if (isDigitalDepartment(department)) {
    if (viewerName === DIGITAL_DIRECTOR_NAME) {
      const members = helpers.employeesInDepartment('Digital');
      if (members.length < 2) return null;
      return { kind: 'digital-department', label: 'Digital', members };
    }

    if (isDigitalGroupLeadName(viewerName)) {
      const lead = helpers.findByName(viewerName) ?? viewer;
      const members = sortMembers([lead, ...helpers.directReports(viewerName)]);
      if (members.length < 2) return null;
      return { kind: 'digital-group', label: groupLeadLabel(viewerName), members };
    }

    const managerName = viewer.manager.trim();
    if (!managerName) return null;

    const members = sortMembers(
      allEmployees.filter(
        (emp) =>
          emp.department.trim() === 'Digital' &&
          (emp.name.trim() === managerName || emp.manager.trim() === managerName)
      )
    );
    if (members.length < 2) return null;
    return { kind: 'digital-group', label: groupLeadLabel(managerName), members };
  }

  const members = helpers.employeesInDepartment(department);
  if (members.length < 2) return null;
  return { kind: 'department', label: department, members };
}

export function vacationTeamScopeToDepartments(scope: VacationTeamScope) {
  return [{ name: scope.label, employees: scope.members }];
}
