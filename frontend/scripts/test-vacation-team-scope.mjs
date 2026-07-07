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

const resolveScope = (viewer) => {
  const department = viewer.department.trim();
  const viewerName = viewer.name.trim();

  if (department === 'Digital') {
    if (viewerName === DIGITAL_DIRECTOR_NAME) {
      return { label: 'Digital', members: employeesInDepartment('Digital') };
    }
    if (isDigitalGroupLeadName(viewerName)) {
      const lead = findByName(viewerName) ?? viewer;
      const members = [lead, ...directReports(viewerName)].filter(
        (emp, idx, arr) => arr.findIndex((x) => x.id === emp.id) === idx
      );
      return { label: `Digital · ${viewerName.split(' ')[0]}`, members };
    }
    const managerName = viewer.manager.trim();
    const members = employees.filter(
      (emp) =>
        emp.department.trim() === 'Digital' &&
        (emp.name.trim() === managerName || emp.manager.trim() === managerName)
    );
    return { label: `Digital · ${managerName.split(' ')[0]}`, members };
  }

  return { label: department, members: employeesInDepartment(department) };
};

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const tskhaiReport = employees.find((e) => e.manager === 'Цхай Виталий' && e.name !== 'Цхай Виталий');
const revzina = findByName(DIGITAL_DIRECTOR_NAME);
const tskhai = findByName('Цхай Виталий');
const devEmployee = employees.find((e) => e.department === 'DEV' && e.name !== 'Баранова Юлия');
const seoEmployee = employees.find((e) => e.department === 'SEO / ORM');

const tskhaiScope = resolveScope(tskhaiReport);
assert(
  tskhaiScope.members.every((e) => e.manager === 'Цхай Виталий' || e.name === 'Цхай Виталий'),
  'digital employee sees only their group'
);
assert(tskhaiScope.members.some((e) => e.name === 'Цхай Виталий'), 'group includes lead');

const leadScope = resolveScope(tskhai);
assert(leadScope.members.length >= 2, 'group lead has team');
assert(leadScope.members.some((e) => e.name === 'Цхай Виталий'), 'lead included');

const directorScope = resolveScope(revzina);
assert(
  directorScope.members.length === employeesInDepartment('Digital').length,
  'director sees full digital'
);

const devScope = resolveScope(devEmployee);
assert(devScope.members.every((e) => e.department === 'DEV'), 'dev sees dev department');

const seoScope = resolveScope(seoEmployee);
assert(seoScope.members.every((e) => e.department === 'SEO / ORM'), 'seo sees seo department');

console.log('OK vacation team scope:', {
  digitalEmployeeGroup: tskhaiScope.members.length,
  digitalLeadGroup: leadScope.members.length,
  digitalDirector: directorScope.members.length,
  devDepartment: devScope.members.length,
  seoDepartment: seoScope.members.length
});
