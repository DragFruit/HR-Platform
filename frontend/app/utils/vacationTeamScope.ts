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

    const leadsSubsetInTeam = members.some((emp) => emp.manager.trim() === name);
    if (!leadsSubsetInTeam) continue;

    // Не поднимаемся выше тимлида: если в списке уже есть руководитель с подчинёнными, его начальника не добавляем.
    const skipUpperManager = members.some(
      (emp) =>
        emp.manager.trim() === name &&
        members.some((peer) => peer.manager.trim() === emp.name.trim())
    );
    if (skipUpperManager) continue;

    combined.push(mgr);
  }

  return sortMembers(combined);
}

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
      const members = enrichTeamMembers(
        [lead, ...helpers.directReports(viewerName)],
        helpers.findByName,
        viewer
      );
      if (members.length < 2) return null;
      return { kind: 'digital-group', label: groupLeadLabel(viewerName), members };
    }

    const managerName = viewer.manager.trim();
    if (!managerName) return null;

    const members = enrichTeamMembers(
      allEmployees.filter(
        (emp) =>
          emp.department.trim() === 'Digital' &&
          (emp.name.trim() === managerName || emp.manager.trim() === managerName)
      ),
      helpers.findByName,
      viewer
    );
    if (members.length < 2) return null;
    return { kind: 'digital-group', label: groupLeadLabel(managerName), members };
  }

  const members = enrichTeamMembers(
    helpers.employeesInDepartment(department),
    helpers.findByName,
    viewer
  );
  if (members.length < 2) return null;
  return { kind: 'department', label: department, members };
}

export function vacationTeamScopeToDepartments(scope: VacationTeamScope) {
  return [{ name: scope.label, employees: scope.members }];
}
