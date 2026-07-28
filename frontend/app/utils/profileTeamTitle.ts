/** Родительный падеж для «Твоя команда …» — по справочнику отделов. */
const DEPARTMENT_GENITIVE: Record<string, string> = {
  Digital: 'Digital',
  DEV: 'DEV',
  'SEO / ORM': 'SEO / ORM',
  Бухгалтерия: 'Бухгалтерии',
  'Внутренние проекты': 'внутренних проектов',
  Дирекция: 'Дирекции',
  Маркетинг: 'Маркетинга',
  'Отдел продаж': 'продаж',
  Таргет: 'Таргета',
  'QA Тестировщики': 'тестировщиков'
};

export const departmentGenitiveForTeam = (department: string): string => {
  const trimmed = department.trim();
  if (!trimmed) return '';

  const mapped = DEPARTMENT_GENITIVE[trimmed];
  if (mapped) return mapped;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('отдел ')) {
    return trimmed.slice(6).trim().toLowerCase();
  }

  if (trimmed.endsWith('ия')) return `${trimmed.slice(0, -2)}ии`;
  if (trimmed.endsWith('инг')) return `${trimmed.slice(0, -1)}а`;
  if (trimmed.endsWith('ет')) return `${trimmed.slice(0, -1)}а`;

  return trimmed;
};

export const profileTeamHeading = (department: string): string => {
  const gen = departmentGenitiveForTeam(department);
  if (!gen) return 'Твоя команда';
  return `Твоя команда ${gen}`;
};
