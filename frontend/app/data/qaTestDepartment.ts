export const QA_TEST_DEPARTMENT_NAME = 'Тестировщики';
export const QA_TEAM_LEAD_NAME = 'Виталий';
export const QA_DIRECTOR_NAME = 'Ксюша';

/**
 * Подсказки для демо-аккаунтов QA.
 * В production держим пустым объектом: фича отключается через env.
 */
export const QA_DEMO_ACCOUNT_HINTS: Record<string, string> = {};

/**
 * На production QA-демо выключен, поэтому любые overrides — no-op.
 * Функции оставлены, чтобы серверный и клиентский код собирались одинаково.
 */
export const applyQaDemoSessionOverrides = <T>(user: T): T => user;

export const mergeQaTestEmployees = <T>(employees: T[]): T[] => employees;

export const stripQaTestEmployees = <T>(employees: T[]): T[] => employees;
