import type { Employee } from '~/composables/useEmployees';
import { employeeNamesMatch } from '~/utils/employeeName';

/**
 * Руководители отделов: в зоне — весь отдел, не только прямые подчинённые.
 * Лашин в справочнике в «Дирекции», но команда — «Отдел продаж».
 * Согласовано с напоминаниями руководителю (vacationManagerMonthReminder).
 * Ключи — канонические «Фамилия Имя» (конфиг); матч с сотрудником — по id.
 */
export const DEPARTMENT_SCOPE_BY_MANAGER: Readonly<Record<string, string>> = {
  'Ревзина Ксения': 'Digital',
  'Музыка Сергей': 'DEV',
  'Трубицына Анна': 'SEO / ORM',
  'Волдайский Кирилл': 'Маркетинг',
  'Малиновская Евгения': 'Бухгалтерия',
  'Лашин Владислав': 'Отдел продаж',
  /** Демо-вход `alina@vbi.local` — проверка большой команды без Bitrix Ревзиной */
  'Алина Тестова': 'Тестировщики',
  'Мария Тестова': 'Тестировщики'
};

const directorIdForScopeKey = (
  directorName: string,
  employees: Array<Pick<Employee, 'id' | 'name'>>
): number | null => {
  const found = employees.find((emp) => employeeNamesMatch(emp.name, directorName));
  return found?.id ?? null;
};

/** Отдел «командной зоны» директора; иначе null → только прямые подчинённые. */
export function departmentScopeForManager(
  manager: Pick<Employee, 'id' | 'name'> | string | null | undefined,
  employees: Array<Pick<Employee, 'id' | 'name'>> = []
): string | null {
  if (!manager) return null;

  if (typeof manager === 'string') {
    const trimmed = manager.trim();
    if (!trimmed) return null;
    const exact = DEPARTMENT_SCOPE_BY_MANAGER[trimmed];
    if (exact) return exact;
    if (!employees.length) return null;
    const me = employees.find((emp) => employeeNamesMatch(emp.name, trimmed));
    if (!me) return null;
    return departmentScopeForManager(me, employees);
  }

  for (const [directorName, dept] of Object.entries(DEPARTMENT_SCOPE_BY_MANAGER)) {
    const directorId = directorIdForScopeKey(directorName, employees);
    if (directorId != null && directorId === manager.id) return dept;
  }
  return null;
}
