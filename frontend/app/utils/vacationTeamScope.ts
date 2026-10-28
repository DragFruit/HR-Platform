import type { Employee } from '~/composables/useEmployees';
import { employeeNamesMatch } from '~/utils/employeeName';
import {
  isGroupedVacationDepartment,
  resolveVacationDepartmentsForDepartment
} from '~/utils/vacationDepartmentGroups';
import { seesCompanyWideVacationCalendar } from '~/utils/companyWideVacationViewer';

export type VacationTeamScopeKind = 'grouped-department' | 'department' | 'company';

export type VacationTeamScope = {
  kind: VacationTeamScopeKind;
  label: string;
  members: Employee[];
};

type ScopeHelpers = {
  employeesInDepartment: (department: string) => Employee[];
  directReports: (managerName: string) => Employee[];
  findByName: (name: string) => Employee | undefined;
  allEmployees?: Employee[];
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

/** Добавляет руководителей отдела (из поля manager) и самого зрителя в список команды. */
export function enrichTeamMembers(
  members: Employee[],
  findByName: (name: string) => Employee | undefined,
  viewer?: Employee | null
): Employee[] {
  const managerNames = new Set<string>();
  for (const emp of members) {
    const mgr = emp.manager.trim();
    if (mgr) managerNames.add(mgr);
  }

  const combined = [...members];
  if (viewer) combined.unshift(viewer);

  for (const name of managerNames) {
    const mgr = findByName(name);
    if (!mgr) continue;
    if (members.some((emp) => emp.id === mgr.id)) continue;

    const leadsSubsetInTeam = members.some((emp) => employeeNamesMatch(emp.manager, name));
    if (!leadsSubsetInTeam) continue;

    const skipUpperManager = members.some(
      (emp) =>
        employeeNamesMatch(emp.manager, name) &&
        members.some((peer) => employeeNamesMatch(peer.manager, emp.name))
    );
    if (skipUpperManager) continue;

    combined.push(mgr);
  }

  return sortMembers(combined);
}

/**
 * Общий календарь отпусков для сотрудника:
 * - Digital и QA «Тестировщики»: весь отдел (сгруппированный в UI);
 * - остальные отделы: все сотрудники отдела, включая руководителей;
 * - главный бухгалтер (по должности): вся компания по отделам — только просмотр.
 */
export function resolveVacationTeamScope(
  viewer: Employee | null | undefined,
  allEmployees: Employee[],
  helpers: ScopeHelpers
): VacationTeamScope | null {
  if (!viewer?.name.trim()) return null;

  if (seesCompanyWideVacationCalendar(viewer.title)) {
    const members = sortMembers(allEmployees);
    if (members.length >= 2) return { kind: 'company', label: 'Вся компания', members };
  }

  const department = viewer.department.trim();
  if (!department) return null;

  if (isGroupedVacationDepartment(department)) {
    const members = enrichTeamMembers(
      helpers.employeesInDepartment(department),
      helpers.findByName,
      viewer
    );
    if (members.length < 2) return null;
    return { kind: 'grouped-department', label: department, members };
  }

  const members = enrichTeamMembers(
    helpers.employeesInDepartment(department),
    helpers.findByName,
    viewer
  );
  if (members.length < 2) return null;
  return { kind: 'department', label: department, members };
}

export function vacationTeamScopeToDepartments(
  scope: VacationTeamScope,
  helpers?: Pick<ScopeHelpers, 'directReports' | 'findByName'> & { allEmployees?: Employee[] }
) {
  if (scope.kind === 'company') {
    const map = new Map<string, Employee[]>();
    for (const emp of scope.members) {
      const dept = emp.department.trim() || 'Без отдела';
      const bucket = map.get(dept) ?? [];
      bucket.push(emp);
      map.set(dept, bucket);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'ru'))
      .map(([name, employees]) => ({ name, employees }));
  }
  if (scope.kind === 'grouped-department' && helpers?.allEmployees) {
    return resolveVacationDepartmentsForDepartment(scope.label, helpers.allEmployees, {
      directReports: helpers.directReports,
      findByName: helpers.findByName
    });
  }
  return [{ name: scope.label, employees: scope.members }];
}
