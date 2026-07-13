/**
 * Smoke-тест области общего календаря отпусков сотрудника.
 * Запуск: node frontend/scripts/test-vacation-team-scope.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const employees = JSON.parse(readFileSync(join(root, 'server/data/employees.json'), 'utf8'));

const DIGITAL_DIRECTOR_NAME = 'Ревзина Ксения';
const DIGITAL_GROUP_LEAD_SURNAMES = new Set(['Попов', 'Лунин', 'Цхай', 'Носков']);

const isDigitalGroupLeadName = (name) => DIGITAL_GROUP_LEAD_SURNAMES.has(name.trim().split(/\s+/)[0] ?? '');

const employeesInDepartment = (department) =>
  employees
    .filter((emp) => emp.department.trim() === department && emp.name.trim())
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

const directReports = (managerName) =>
  employees.filter(
    (emp) => emp.manager.trim() === managerName.trim() && emp.name.trim() !== managerName.trim()
  );

const findByName = (name) => employees.find((emp) => emp.name === name);

const sortMembers = (list) => {
  const seen = new Set();
  const unique = [];
  for (const emp of list) {
    if (!emp.name.trim() || seen.has(emp.id)) continue;
    seen.add(emp.id);
    unique.push(emp);
  }
  return unique.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
};

const enrichTeamMembers = (members, viewer) => {
  const managerNames = new Set();
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
    const skipUpperManager = members.some(
      (emp) =>
        emp.manager.trim() === name &&
        members.some((peer) => peer.manager.trim() === emp.name.trim())
    );
    if (skipUpperManager) continue;
    combined.push(mgr);
  }
  return sortMembers(combined);
};

const resolveScope = (viewer) => {
  const department = viewer.department.trim();
  const viewerName = viewer.name.trim();

  if (department === 'Digital' || department === 'Тестировщики') {
    return {
      label: department,
      members: enrichTeamMembers(employeesInDepartment(department), viewer)
    };
  }

  return { label: department, members: enrichTeamMembers(employeesInDepartment(department), viewer) };
};

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const tskhaiReport = employees.find((e) => e.manager === 'Цхай Виталий' && e.name !== 'Цхай Виталий');
const revzina = findByName(DIGITAL_DIRECTOR_NAME);
const tskhai = findByName('Цхай Виталий');
const devEmployee = employees.find((e) => e.department === 'DEV' && e.name !== 'Баранова Юлия');
const seoEmployee = employees.find((e) => e.department === 'SEO / ORM');
const muzika = findByName('Музыка Сергей');

const tskhaiScope = resolveScope(tskhaiReport);
assert(
  tskhaiScope.members.length === employeesInDepartment('Digital').length,
  'digital employee sees full department'
);

const leadScope = resolveScope(tskhai);
assert(
  leadScope.members.length === employeesInDepartment('Digital').length,
  'digital group lead in employee view sees full department'
);

const directorScope = resolveScope(revzina);
assert(
  directorScope.members.length === employeesInDepartment('Digital').length,
  'director sees full digital'
);

const devScope = resolveScope(devEmployee);
assert(devScope.members.every((e) => e.department === 'DEV'), 'dev sees dev department');

const seoScope = resolveScope(seoEmployee);
assert(seoScope.members.every((e) => e.department === 'SEO / ORM'), 'seo sees seo department');

const salesEmployee = employees.find((e) => e.department === 'Отдел продаж' && e.manager === 'Лашин Владислав');
const lashin = findByName('Лашин Владислав');
const salesScope = resolveScope(salesEmployee);
assert(salesScope.members.some((e) => e.name === 'Лашин Владислав'), 'sales team includes department head');
assert(salesScope.members.some((e) => e.name === salesEmployee.name), 'sales employee included');

const muzikaScope = resolveScope(muzika);
assert(muzikaScope.members.some((e) => e.name === 'Музыка Сергей'), 'dev head sees self in team calendar');

console.log('OK vacation team scope:', {
  digitalEmployeeGroup: tskhaiScope.members.length,
  digitalLeadGroup: leadScope.members.length,
  digitalDirector: directorScope.members.length,
  devDepartment: devScope.members.length,
  seoDepartment: seoScope.members.length,
  salesWithHead: salesScope.members.length,
  devHeadIncluded: muzikaScope.members.some((e) => e.name === 'Музыка Сергей')
});
