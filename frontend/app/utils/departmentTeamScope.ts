/**
 * Руководители отделов: в зоне — весь отдел, не только прямые подчинённые.
 * Лашин в справочнике в «Дирекции», но команда — «Отдел продаж».
 * Согласовано с напоминаниями руководителю (vacationManagerMonthReminder).
 */
export const DEPARTMENT_SCOPE_BY_MANAGER: Readonly<Record<string, string>> = {
  'Ревзина Ксения': 'Digital',
  'Музыка Сергей': 'DEV',
  'Трубицына Анна': 'SEO / ORM',
  'Волдайский Кирилл': 'Маркетинг',
  'Малиновская Евгения': 'Бухгалтерия',
  'Лашин Владислав': 'Отдел продаж'
};

/** Отдел «командной зоны» директора; иначе null → только прямые подчинённые. */
export function departmentScopeForManager(managerName: string): string | null {
  const trimmed = managerName.trim();
  if (!trimmed) return null;
  return DEPARTMENT_SCOPE_BY_MANAGER[trimmed] ?? null;
}
