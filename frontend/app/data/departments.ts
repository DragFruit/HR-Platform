/** Канонический список отделов (выпадающий список в админке). */
export const CANONICAL_DEPARTMENTS = [
  'DEV',
  'Digital',
  'SEO / ORM',
  'Бухгалтерия',
  'Внутренние проекты',
  'Маркетинг',
  'Дирекция',
  'Отдел продаж'
] as const;

export type CanonicalDepartment = (typeof CANONICAL_DEPARTMENTS)[number];

/** Старые названия → канонические (миграция справочника). */
export const DEPARTMENT_ALIASES: Record<string, CanonicalDepartment> = {
  'DEV&TS': 'DEV',
  DEV_accounting: 'DEV',
  'Отдел разработки': 'DEV',
  Digital: 'Digital',
  'Группа 3 - Виталий Цхай': 'Digital',
  SEO: 'SEO / ORM',
  ORM: 'SEO / ORM',
  'SEO / ORM': 'SEO / ORM',
  'SEO аккаунтинг': 'SEO / ORM',
  Бухгалтерия: 'Бухгалтерия',
  'Внутренние проекты': 'Внутренние проекты',
  Маркетинг: 'Маркетинг',
  Дирекция: 'Дирекция',
  Руководство: 'Дирекция',
  'Отдел продаж': 'Отдел продаж'
};

export function normalizeDepartment(value: string): CanonicalDepartment | '' {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if ((CANONICAL_DEPARTMENTS as readonly string[]).includes(trimmed)) {
    return trimmed as CanonicalDepartment;
  }
  return DEPARTMENT_ALIASES[trimmed] ?? '';
}

/** Отделы для UI: канонические + QA «Тестировщики» на localhost. */
export function listDepartmentsForUi(includeQaTestDepartment = false): string[] {
  const base = [...CANONICAL_DEPARTMENTS];
  if (includeQaTestDepartment && !base.includes('Тестировщики')) {
    base.push('Тестировщики');
  }
  return base;
}
