import type { Employee } from '~/composables/useEmployees';

export const QA_TEST_DEPARTMENT_NAME = 'Тестировщики';

export const QA_DIRECTOR_NAME = 'Ксюша Тестова';
export const QA_TEAM_LEAD_NAME = 'Виталий Тестов';
export const QA_EMPLOYEE_NAME = 'Даша Тестова';

/** Стабильные id — не попадают в employees.json при сохранении. */
export const QA_EMPLOYEE_IDS = [9001, 9002, 9003] as const;
export const QA_EMPLOYEE_ID_SET = new Set<number>(QA_EMPLOYEE_IDS);

const QA_DEMO_EMAILS = new Set([
  'masha@vbi.local',
  'kostya@vbi.local',
  'katya@vbi.local'
]);

export function isQaTestDepartmentEnabledFromEnv(
  env: Record<string, string | undefined> = process.env
): boolean {
  const flag = env.NUXT_PUBLIC_QA_TEST_DEPARTMENT;
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  return env.NODE_ENV === 'development';
}

export function isQaTestEmployeeId(id: number): boolean {
  return QA_EMPLOYEE_ID_SET.has(id);
}

export function isQaTestEmployeeRow(row: { id: number }): boolean {
  return isQaTestEmployeeId(row.id);
}

export function buildQaTestEmployees(): Employee[] {
  return [
    {
      id: 9001,
      name: QA_DIRECTOR_NAME,
      title: 'Директор',
      department: QA_TEST_DEPARTMENT_NAME,
      manager: '',
      hired_at: '2024-01-15',
      platform_user_id: 5,
      email: 'masha@vbi.local',
      account_role: 'manager',
      vacation_opening_balance: 28
    },
    {
      id: 9002,
      name: QA_TEAM_LEAD_NAME,
      title: 'Тимлид',
      department: QA_TEST_DEPARTMENT_NAME,
      manager: QA_DIRECTOR_NAME,
      hired_at: '2024-03-01',
      platform_user_id: 2,
      email: 'kostya@vbi.local',
      account_role: 'manager',
      vacation_opening_balance: 28
    },
    {
      id: 9003,
      name: QA_EMPLOYEE_NAME,
      title: 'Тестировщик',
      department: QA_TEST_DEPARTMENT_NAME,
      manager: QA_TEAM_LEAD_NAME,
      hired_at: '2025-01-10',
      platform_user_id: 3,
      email: 'katya@vbi.local',
      account_role: 'employee',
      vacation_opening_balance: 28
    }
  ];
}

export function mergeQaTestEmployees<T extends { id: number }>(list: T[]): T[] {
  if (!isQaTestDepartmentEnabledFromEnv()) return list;
  const withoutQa = list.filter((row) => !isQaTestEmployeeRow(row));
  return [...withoutQa, ...(buildQaTestEmployees() as T[])];
}

export function stripQaTestEmployees<T extends { id: number }>(list: T[]): T[] {
  return list.filter((row) => !isQaTestEmployeeRow(row));
}

/** Демо-вход: роль и отдел для тестовой цепочки согласования. */
export function applyQaDemoSessionOverrides<T extends { email: string; role: string; department: string }>(
  user: T
): T {
  if (!isQaTestDepartmentEnabledFromEnv()) return user;
  const email = user.email.trim().toLowerCase();
  if (!QA_DEMO_EMAILS.has(email)) return user;

  const next = { ...user, department: QA_TEST_DEPARTMENT_NAME };
  if (email === 'masha@vbi.local' || email === 'kostya@vbi.local') {
    next.role = 'manager';
  } else if (email === 'katya@vbi.local') {
    next.role = 'employee';
  }
  return next;
}

export const QA_DEMO_ACCOUNT_HINTS: Record<string, string> = {
  'masha@vbi.local': 'QA: Ксюша Тестова — директор «Тестировщики»',
  'kostya@vbi.local': 'QA: Виталий Тестов — тимлид, согласование шаг 1',
  'katya@vbi.local': 'QA: Даша Тестова — сотрудник, заявки на отпуск'
};
