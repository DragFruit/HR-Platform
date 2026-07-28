import type { Employee } from '~/composables/useEmployees';

export const QA_TEST_DEPARTMENT_NAME = 'Тестировщики';

export const QA_DIRECTOR_NAME = 'Мария Тестова';
export const QA_TEAM_LEAD_NAME = 'Константин Тестов';
export const QA_EMPLOYEE_DASHA_NAME = 'Даша Тестова';
export const QA_EMPLOYEE_VASILY_NAME = 'Василий Тестов';
export const QA_EMPLOYEE_ALINA_NAME = 'Алина Тестова';
export const QA_EMPLOYEE_MARINA_NAME = 'Марина Тестова';

/** @deprecated используйте QA_EMPLOYEE_DASHA_NAME */
export const QA_EMPLOYEE_NAME = QA_EMPLOYEE_DASHA_NAME;

/** Стабильные id — не попадают в employees.json при сохранении. */
export const QA_BULK_REPORT_COUNT = 24;
export const QA_BULK_REPORT_ID_START = 9201;
export const QA_BULK_REPORT_IDS = Array.from(
  { length: QA_BULK_REPORT_COUNT },
  (_, i) => QA_BULK_REPORT_ID_START + i
);

export const QA_EMPLOYEE_IDS = [
  9001,
  9002,
  9003,
  9004,
  9005,
  9006,
  9100,
  ...QA_BULK_REPORT_IDS
] as const;
export const QA_EMPLOYEE_ID_SET = new Set<number>(QA_EMPLOYEE_IDS);
export const QA_EMPLOYEE_JUBILEE_NAME = 'Юбилеев Тест';

export const QA_TEAM_MEMBER_NAMES = [
  QA_DIRECTOR_NAME,
  QA_TEAM_LEAD_NAME,
  QA_EMPLOYEE_DASHA_NAME,
  QA_EMPLOYEE_VASILY_NAME,
  QA_EMPLOYEE_ALINA_NAME,
  QA_EMPLOYEE_MARINA_NAME
] as const;

const QA_DEMO_EMAILS = new Set([
  'masha@vbi.local',
  'kostya@vbi.local',
  'katya@vbi.local',
  'vasya@vbi.local',
  'alina@vbi.local',
  'jubilee@vbi.local'
]);

const QA_DEMO_SESSION_NAMES: Record<string, string> = {
  'masha@vbi.local': QA_DIRECTOR_NAME,
  'kostya@vbi.local': QA_TEAM_LEAD_NAME,
  'katya@vbi.local': QA_EMPLOYEE_DASHA_NAME,
  'vasya@vbi.local': QA_EMPLOYEE_VASILY_NAME,
  'alina@vbi.local': QA_EMPLOYEE_ALINA_NAME,
  'jubilee@vbi.local': QA_EMPLOYEE_JUBILEE_NAME
};

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
      name: QA_EMPLOYEE_DASHA_NAME,
      title: 'Тестировщик',
      department: QA_TEST_DEPARTMENT_NAME,
      manager: QA_TEAM_LEAD_NAME,
      hired_at: '2025-01-10',
      platform_user_id: 3,
      email: 'katya@vbi.local',
      account_role: 'employee',
      vacation_opening_balance: 28
    },
    {
      id: 9004,
      name: QA_EMPLOYEE_VASILY_NAME,
      title: 'Тестировщик',
      department: QA_TEST_DEPARTMENT_NAME,
      manager: QA_TEAM_LEAD_NAME,
      hired_at: '2025-03-12',
      platform_user_id: 4,
      email: 'vasya@vbi.local',
      account_role: 'employee',
      vacation_opening_balance: 28
    },
    {
      id: 9005,
      name: QA_EMPLOYEE_ALINA_NAME,
      title: 'Тестировщик',
      department: QA_TEST_DEPARTMENT_NAME,
      manager: QA_TEAM_LEAD_NAME,
      hired_at: '2025-06-01',
      platform_user_id: 6,
      email: 'alina@vbi.local',
      account_role: 'employee',
      vacation_opening_balance: 28
    },
    {
      id: 9006,
      name: QA_EMPLOYEE_MARINA_NAME,
      title: 'Тестировщик',
      department: QA_TEST_DEPARTMENT_NAME,
      manager: QA_TEAM_LEAD_NAME,
      hired_at: '2025-09-20',
      platform_user_id: null,
      email: '',
      account_role: 'employee',
      vacation_opening_balance: 28
    },
    {
      id: 9100,
      name: QA_EMPLOYEE_JUBILEE_NAME,
      title: 'Тестовый юбиляр (5 лет)',
      department: 'Digital',
      manager: 'Цхай Виталий',
      /** 5 лет на 2026-07-24 — день юбилея для теста оверлея */
      hired_at: '2021-07-24',
      platform_user_id: 9100,
      email: 'jubilee@vbi.local',
      account_role: 'employee',
      vacation_opening_balance: 28
    },
    /* 24 filler-подчинённых Кости → всего 28 reports + он сам = 29 в таблице отпусков */
    ...QA_BULK_REPORT_IDS.map((id, index) => {
      const n = index + 1;
      const pad = String(n).padStart(2, '0');
      return {
        id,
        name: `Тестовый Сотрудник ${pad}`,
        title: 'Тестировщик',
        department: QA_TEST_DEPARTMENT_NAME,
        manager: QA_TEAM_LEAD_NAME,
        hired_at: `2025-${String(((n - 1) % 12) + 1).padStart(2, '0')}-15`,
        platform_user_id: null as number | null,
        email: '',
        account_role: 'employee' as const,
        vacation_opening_balance: 28
      };
    })
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

/** Демо-вход: роль, отдел и отображаемое имя для тестовой цепочки. */
export function applyQaDemoSessionOverrides<
  T extends { email: string; role: string; department: string; name: string }
>(user: T): T {
  if (!isQaTestDepartmentEnabledFromEnv()) return user;
  const email = user.email.trim().toLowerCase();
  if (!QA_DEMO_EMAILS.has(email)) return user;

  const next = { ...user, department: QA_TEST_DEPARTMENT_NAME };
  const displayName = QA_DEMO_SESSION_NAMES[email];
  if (displayName) next.name = displayName;
  if (email === 'masha@vbi.local' || email === 'kostya@vbi.local') {
    next.role = 'manager';
  } else if (
    email === 'katya@vbi.local' ||
    email === 'vasya@vbi.local' ||
    email === 'alina@vbi.local' ||
    email === 'jubilee@vbi.local'
  ) {
    next.role = 'employee';
  }
  if (email === 'jubilee@vbi.local') {
    next.department = 'Digital';
  }
  return next;
}

export const QA_DEMO_ACCOUNT_HINTS: Record<string, string> = {
  'kostya@vbi.local': `Руководитель: ${QA_TEAM_LEAD_NAME} — команда 28 чел. (+он = 29 в таблице), согласование шаг 1`,
  'katya@vbi.local': 'Сотрудник: Даша Тестова — заявки, бронь, обучалка',
  'vasya@vbi.local': 'Сотрудник: Василий Тестов — свой календарь и заявки',
  'alina@vbi.local': 'Сотрудник: Алина Тестова — заявка на согласовании',
  'jubilee@vbi.local': 'Юбиляр: 5 лет в компании — тест поздравления / ачивки / купона',
  'masha@vbi.local': `Директор: ${QA_DIRECTOR_NAME} — согласование шаг 2`,
  'stas@vbi.local': 'Администратор платформы (HR)'
};

/** Порядок карточек на экране входа для демо-показа. */
export const QA_DEMO_ACCOUNT_ORDER = [
  'katya@vbi.local',
  'vasya@vbi.local',
  'alina@vbi.local',
  'kostya@vbi.local',
  'masha@vbi.local',
  'jubilee@vbi.local',
  'stas@vbi.local'
] as const;
