/**
 * Видимость статей БЗ по отделам (как в оргсхеме).
 * Пустой список departments = «Всем» (общие регламенты).
 */

/** Отделы как в employees.department — для шильдиков и фильтра. */
export const KNOWLEDGE_DEPARTMENT_OPTIONS = [
  'Digital',
  'DEV',
  'SEO / ORM',
  'Отдел продаж',
  'Маркетинг',
  'Бухгалтерия',
  'Дирекция',
  'Внутренние проекты',
  'HR'
] as const;

export type KnowledgeDepartment = (typeof KNOWLEDGE_DEPARTMENT_OPTIONS)[number];

const TITLE_TAG_TO_DEPT: { re: RegExp; dept: string }[] = [
  { re: /\[?\s*DIGITAL\s*\]?/i, dept: 'Digital' },
  { re: /\[?\s*SEO\s*\/?\s*SERM\s*\]?/i, dept: 'SEO / ORM' },
  { re: /\[?\s*SEO\s*\]?/i, dept: 'SEO / ORM' },
  { re: /\[?\s*Отдел продаж\s*\]?/i, dept: 'Отдел продаж' },
  { re: /\[?\s*Финансы\s*\]?/i, dept: 'Бухгалтерия' },
  { re: /\[?\s*Финансы\s*\/\s*Бухгалтерия\s*\]?/i, dept: 'Бухгалтерия' },
  { re: /разработк/i, dept: 'DEV' },
  { re: /\[?\s*Маркетинг\s*\]?/i, dept: 'Маркетинг' },
  { re: /\[?\s*ГХ/i, dept: 'Отдел продаж' }
];

const CRUMB_TO_DEPT: { re: RegExp; dept: string | 'all' }[] = [
  { re: /^общие\s+по\s+компании$/i, dept: 'all' },
  { re: /^digital$/i, dept: 'Digital' },
  { re: /seo|serm|orm/i, dept: 'SEO / ORM' },
  { re: /отдел\s+продаж|продаж/i, dept: 'Отдел продаж' },
  { re: /финанс|бухгалтер/i, dept: 'Бухгалтерия' },
  { re: /разработ|dev/i, dept: 'DEV' },
  { re: /маркетинг/i, dept: 'Маркетинг' },
  { re: /дирекци/i, dept: 'Дирекция' },
  { re: /внутренн/i, dept: 'Внутренние проекты' },
  { re: /^hr/i, dept: 'HR' }
];

export function normalizeDepartmentList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(KNOWLEDGE_DEPARTMENT_OPTIONS.map((d) => d.toLowerCase()));
  const out: string[] = [];
  for (const item of value) {
    const raw = String(item || '').trim();
    if (!raw) continue;
    const hit = KNOWLEDGE_DEPARTMENT_OPTIONS.find((d) => d.toLowerCase() === raw.toLowerCase());
    if (hit && !out.includes(hit)) out.push(hit);
    else if (!allowed.has(raw.toLowerCase()) && raw.length <= 40 && !out.includes(raw)) {
      // неизвестный отдел из данных — сохраняем как есть
      out.push(raw);
    }
  }
  return out.slice(0, 12);
}

/** Вывести отделы из крошек и заголовка, если в статье ещё не заданы. */
export function inferArticleDepartments(title: string, breadcrumbs: string[]): string[] {
  const crumbs = breadcrumbs.map((c) => c.trim()).filter(Boolean);
  if (crumbs.some((c) => /^общие\s+по\s+компании$/i.test(c))) {
    return [];
  }

  const found = new Set<string>();
  for (const c of crumbs) {
    for (const rule of CRUMB_TO_DEPT) {
      if (!rule.re.test(c)) continue;
      if (rule.dept === 'all') return [];
      found.add(rule.dept);
    }
  }

  for (const rule of TITLE_TAG_TO_DEPT) {
    if (rule.re.test(title)) found.add(rule.dept);
  }

  return [...found];
}

export function resolveArticleDepartments(opts: {
  departments?: unknown;
  title: string;
  breadcrumbs: string[];
}): string[] {
  if (Array.isArray(opts.departments)) {
    return normalizeDepartmentList(opts.departments);
  }
  return inferArticleDepartments(opts.title, opts.breadcrumbs);
}

/** Подпись для шильдика. */
export function departmentBadgeLabel(departments: string[]): string {
  if (!departments.length) return 'Всем';
  if (departments.length === 1) return departments[0]!;
  return departments.join(' · ');
}

/**
 * Как отдел может прийти в сессию: сырое имя из Bitrix `department.get` (вход через Bitrix —
 * «Digital отдел», «SEO отдел», «Отдел разработки»…) вместо имени из справочника Vibe.
 * Сводим к названию из KNOWLEDGE_DEPARTMENT_OPTIONS — иначе точное сравнение со «Digital» не проходит.
 */
const VIEWER_DEPT_ALIASES: { re: RegExp; dept: KnowledgeDepartment }[] = [
  { re: /digital|диджитал|дижитал/i, dept: 'Digital' },
  { re: /\bseo\b|сео|\bserm\b|\borm\b/i, dept: 'SEO / ORM' },
  { re: /^dev$|разработ/i, dept: 'DEV' },
  { re: /продаж/i, dept: 'Отдел продаж' },
  { re: /маркетинг/i, dept: 'Маркетинг' },
  { re: /бухгалт|финанс/i, dept: 'Бухгалтерия' },
  { re: /дирекци/i, dept: 'Дирекция' },
  { re: /внутренн/i, dept: 'Внутренние проекты' },
  { re: /^hr\b/i, dept: 'HR' }
];

/** Название отдела к виду справочника (регистр, Bitrix-варианты); неизвестное — как есть. */
export function canonicalKnowledgeDepartment(value: unknown): string {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const exact = KNOWLEDGE_DEPARTMENT_OPTIONS.find((d) => d.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const alias = VIEWER_DEPT_ALIASES.find((rule) => rule.re.test(raw));
  return alias ? alias.dept : raw;
}

export type KnowledgeViewer = { role: string; department: string };

/**
 * Зритель БЗ: отдел берём из справочника сотрудников (core.employees.department — тот же,
 * по которому размечены статьи), а не из сессии: при входе через Bitrix в сессии лежит
 * имя первого подразделения из Bitrix (подотдел/«Digital отдел»), и Digital-статьи пропадали.
 * Сессия — только запасной вариант, если сотрудника нет в справочнике.
 */
export function knowledgeViewerFrom(
  session: { role: string; department?: string | null },
  employee?: { department?: string | null } | null
): KnowledgeViewer {
  const fromRoster = String(employee?.department || '').trim();
  return {
    role: session.role,
    department: fromRoster || String(session.department || '').trim()
  };
}

/**
 * Видна ли статья сотруднику — единое правило для списка/обычного поиска (/api/knowledge)
 * и для «Спросить ИИ» (RAG).
 * admin/hr — все; пустые departments — всем; иначе совпадение отдела (после canonicalKnowledgeDepartment).
 */
export function canUserSeeArticle(departments: string[], user: KnowledgeViewer): boolean {
  if (user.role === 'admin' || user.role === 'hr') return true;
  if (!departments.length) return true;
  const mine = canonicalKnowledgeDepartment(user.department).toLowerCase();
  if (!mine) return false;
  return departments.some((d) => canonicalKnowledgeDepartment(d).toLowerCase() === mine);
}

export function filterArticlesForUser<T extends { departments: string[] }>(
  articles: T[],
  user: KnowledgeViewer
): T[] {
  return articles.filter((a) => canUserSeeArticle(a.departments, user));
}
