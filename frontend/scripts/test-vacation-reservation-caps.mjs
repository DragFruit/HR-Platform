/**
 * Smoke-тест двухуровневого лимита броней (отдел + подгруппа).
 * Запуск: node frontend/scripts/test-vacation-reservation-caps.mjs
 */

const DEFAULT_DEPARTMENT_CAP = 5;
const DEFAULT_SUBGROUP_CAP = 1;

const countGroupReservationsForMonth = (memberNames, year, month, reservations, excludeEmployee) => {
  const names = new Set(memberNames);
  const exclude = excludeEmployee?.trim().toLowerCase();
  const seen = new Set();
  for (const row of reservations) {
    if (row.year !== year || row.month !== month) continue;
    const employee = row.employee.trim();
    if (!names.has(employee)) continue;
    if (exclude && employee.toLowerCase() === exclude) continue;
    seen.add(employee.toLowerCase());
  }
  return seen.size;
};

const isAtSubgroupCap = (memberNames, reservations, year, month, exclude) =>
  countGroupReservationsForMonth(memberNames, year, month, reservations, exclude) >= DEFAULT_SUBGROUP_CAP;

const isAtDepartmentCap = (memberNames, reservations, year, month, exclude) =>
  countGroupReservationsForMonth(memberNames, year, month, reservations, exclude) >= DEFAULT_DEPARTMENT_CAP;

const getBlockReason = (ctx, year, month, reservations, exclude) => {
  if (isAtSubgroupCap(ctx.subgroup, reservations, year, month, exclude)) return 'subgroup';
  if (isAtDepartmentCap(ctx.department, reservations, year, month, exclude)) return 'department';
  return null;
};

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const qaTeam = ['Константин Тестов', 'Даша Тестова', 'Василий Тестов', 'Алина Тестова', 'Марина Тестова'];
const qaDept = [
  'Мария Тестова',
  'Константин Тестов',
  'Даша Тестова',
  'Василий Тестов',
  'Алина Тестова',
  'Марина Тестова'
];
const ctx = { department: qaDept, subgroup: qaTeam };

const oct = [{ employee: 'Даша Тестова', year: 2026, month: 10 }];

assert(
  getBlockReason(ctx, 2026, 10, oct, 'Марина Тестова') === 'subgroup',
  'second booker in qa-team blocked by subgroup cap'
);
assert(
  getBlockReason(ctx, 2026, 10, oct, 'Даша Тестова') === null,
  'employee with own reservation is not blocked for add button'
);

const octCrowded = [
  { employee: 'Даша Тестова', year: 2026, month: 10 },
  { employee: 'Василий Тестов', year: 2026, month: 10 },
  { employee: 'Алина Тестова', year: 2026, month: 10 },
  { employee: 'Константин Тестов', year: 2026, month: 10 }
];
assert(
  getBlockReason(ctx, 2026, 10, octCrowded, 'Марина Тестова') === 'subgroup',
  'crowded team month still blocks newcomer'
);

const directorCtx = {
  department: qaDept,
  subgroup: ['Мария Тестова']
};
const octWithDirector = [
  ...octCrowded,
  { employee: 'Мария Тестова', year: 2026, month: 10 }
];
assert(
  getBlockReason(directorCtx, 2026, 10, octWithDirector, 'Мария Тестова') === null,
  'director keeps own month'
);
assert(
  getBlockReason(ctx, 2026, 10, octWithDirector, 'Марина Тестова') === 'subgroup',
  'team member still blocked when director has separate subgroup slot'
);

const fiveAcrossDept = [
  { employee: 'Мария Тестова', year: 2026, month: 11 },
  { employee: 'Даша Тестова', year: 2026, month: 11 },
  { employee: 'Василий Тестов', year: 2026, month: 11 },
  { employee: 'Алина Тестова', year: 2026, month: 11 },
  { employee: 'Константин Тестов', year: 2026, month: 11 }
];
const emptyTeamCtx = { department: qaDept, subgroup: ['Марина Тестова'] };
assert(
  getBlockReason(emptyTeamCtx, 2026, 11, fiveAcrossDept, 'Марина Тестова') === 'department',
  'department cap blocks when five reservations exist'
);

console.log('OK vacation reservation caps');
