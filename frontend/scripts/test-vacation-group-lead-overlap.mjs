/**
 * Smoke-тест: не более одного групхеда в отпуске на пересекающиеся даты.
 * Запуск: node frontend/scripts/test-vacation-group-lead-overlap.mjs
 */

const vacationRangesOverlap = (startA, endA, startB, endB) => {
  const a0 = new Date(`${startA}T00:00:00`);
  const a1 = new Date(`${endA}T00:00:00`);
  const b0 = new Date(`${startB}T00:00:00`);
  const b1 = new Date(`${endB}T00:00:00`);
  return a0 <= b1 && b0 <= a1;
};

const DIGITAL_GROUP_LEAD_SURNAMES = new Set(['Попов', 'Лунин', 'Цхай', 'Носков']);
const isVacationGroupLead = (name, department) =>
  department === 'Digital' && DIGITAL_GROUP_LEAD_SURNAMES.has(name.trim().split(/\s+/)[0] ?? '');

const listVacationGroupLeadNames = (department) => {
  if (department !== 'Digital') return [];
  return ['Цхай Виталий', 'Попов Виктор', 'Лунин Дмитрий', 'Носков Никита'];
};

const findVacationOverlapDetails = (request, allRequests, scopeEmployeeNames) => {
  const scope = scopeEmployeeNames ? new Set(scopeEmployeeNames) : null;
  const details = [];
  for (const other of allRequests) {
    if (other.id === request.id || other.employee === request.employee) continue;
    if (other.status !== 'approved' && other.status !== 'pending') continue;
    if (scope && !scope.has(other.employee)) continue;
    if (!vacationRangesOverlap(request.start, request.end, other.start, other.end)) continue;
    details.push({ employee: other.employee });
  }
  return details;
};

const findGroupLeadVacationOverlaps = (params) => {
  const employee = params.employeeName.trim();
  const department = params.department.trim();
  if (!isVacationGroupLead(employee, department)) return [];
  const otherGroupLeads = listVacationGroupLeadNames(department).filter((name) => name !== employee);
  return findVacationOverlapDetails(
    {
      id: params.excludeRequestId ?? -1,
      employee,
      start: params.start,
      end: params.end
    },
    params.allRequests,
    otherGroupLeads
  );
};

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const requests = [
  {
    id: 1,
    employee: 'Лунин Дмитрий',
    start: '2026-08-01',
    end: '2026-08-10',
    status: 'approved'
  }
];

const overlap = findGroupLeadVacationOverlaps({
  employeeName: 'Цхай Виталий',
  department: 'Digital',
  start: '2026-08-05',
  end: '2026-08-12',
  allRequests: requests
});
assert(overlap.length === 1 && overlap[0].employee === 'Лунин Дмитрий', 'tskhai blocked by lunin');

const noOverlap = findGroupLeadVacationOverlaps({
  employeeName: 'Цхай Виталий',
  department: 'Digital',
  start: '2026-08-11',
  end: '2026-08-20',
  allRequests: requests
});
assert(noOverlap.length === 0, 'non-overlapping dates allowed');

const employeeNotGh = findGroupLeadVacationOverlaps({
  employeeName: 'Громов Максим',
  department: 'Digital',
  start: '2026-08-05',
  end: '2026-08-12',
  allRequests: requests
});
assert(employeeNotGh.length === 0, 'non group lead is not restricted');

console.log('OK vacation group lead overlap');
