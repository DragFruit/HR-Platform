import type { Employee } from '~/composables/useEmployees';
import { normalizeDepartment } from '~/data/departments';
import { normalizeEmployeeNameKey } from '~/utils/employeeName';
import { DIGITAL_VACATION_GROUP_DEFS_EXPORT } from '~/utils/vacationDepartmentGroups';

/** Нормализация названия ноды оргсхемы для матчинга правил. */
export function normalizeOrgUnitKey(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/&/g, ' ')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CONTEXT_MANAGERS = ['Лунин Дмитрий', 'Попов Виктор', 'Цхай Виталий'] as const;
const SMM_MANAGERS = ['Носков Никита'] as const;
const ANALYTICS_NAMES = ['Левина Анастасия', 'Мощев Максим'] as const;

/** Юристы-подрядчики: в списке есть, визитки нет. */
const CONTRACTOR_LAWYERS = [
  { name: 'Марченко Елизавета', title: 'Юрист · подрядчик' },
  { name: 'Анащенко Артём', title: 'Юрист · подрядчик' }
] as const;

export type OrgRosterPerson = {
  key: string;
  name: string;
  title?: string;
  /** false — подрядчик / без публичной карточки */
  openCard: boolean;
  employee?: Employee;
};

export type OrgRosterSection = {
  id: string;
  label: string;
  people: OrgRosterPerson[];
};

type RosterRule =
  | { kind: 'none' }
  | { kind: 'department'; department: string }
  | { kind: 'digital-all' }
  | { kind: 'by-managers'; managers: readonly string[]; department?: string }
  | { kind: 'by-names'; names: readonly string[] }
  | { kind: 'seo-core' }
  | { kind: 'seo-serm-all' }
  | { kind: 'contractors'; people: readonly { name: string; title?: string }[] };

const SEO_ACCOUNTING_NAMES = ['Пяткова Алёна', 'Гончаров Данила'] as const;
const ORM_MANAGER = 'Новоторцева Екатерина';
const SEO_MANAGER = 'Трубицына Анна';

/**
 * Ноды, по которым панель сотрудников не открываем
 * (офис-менеджер, HR-специалист — по одному человеку на схеме).
 */
export function orgUnitOpensRoster(unitName: string): boolean {
  const key = normalizeOrgUnitKey(unitName);
  if (!key) return false;
  if (key.includes('офис')) return false;
  if (key.includes('hr') || key.includes('эйчар') || key.includes('кадр')) return false;
  return true;
}

function matchRule(unitName: string): RosterRule | null {
  const key = normalizeOrgUnitKey(unitName);
  if (!key) return null;

  if (key.includes('офис') || key.includes('hr') || key.includes('эйчар') || key.includes('кадр')) {
    return { kind: 'none' };
  }

  if (key.includes('контекст') || key.includes('медийн')) {
    return { kind: 'by-managers', managers: CONTEXT_MANAGERS, department: 'Digital' };
  }

  if (key.includes('smm') || key.includes('influence') || key.includes('таргет')) {
    return { kind: 'by-managers', managers: SMM_MANAGERS, department: 'Digital' };
  }

  if (key.includes('аналитик')) {
    return { kind: 'by-names', names: ANALYTICS_NAMES };
  }

  if (key.includes('digital') || key.includes('диджитал')) {
    return { kind: 'digital-all' };
  }

  // «внутренних разработок» содержит и «внутренн», и «разработ» — сначала внутренние
  if (key.includes('внутренн')) {
    return { kind: 'department', department: 'Внутренние проекты' };
  }

  if (key.includes('разработ') || key === 'dev' || key.startsWith('dev ')) {
    return { kind: 'department', department: 'DEV' };
  }

  // SEO / ORM / аккаунтинг — узкие ноды раньше общего SEO&SERM
  if (key.includes('аккаунт')) {
    return { kind: 'by-names', names: SEO_ACCOUNTING_NAMES };
  }
  if (key.includes('orm')) {
    return { kind: 'by-managers', managers: [ORM_MANAGER], department: 'SEO / ORM' };
  }
  // «SEO&SERM» — весь блок с секциями; «SEO отдел» — только SEO у Трубицыной
  if (key.includes('serm')) {
    return { kind: 'seo-serm-all' };
  }
  if (key.includes('seo')) {
    return { kind: 'seo-core' };
  }

  if (key.includes('продаж')) {
    return { kind: 'department', department: 'Отдел продаж' };
  }

  if (key.includes('маркетинг')) {
    return { kind: 'department', department: 'Маркетинг' };
  }

  if (key.includes('бухгалтер')) {
    return { kind: 'department', department: 'Бухгалтерия' };
  }

  if (key.includes('юрист')) {
    return { kind: 'contractors', people: CONTRACTOR_LAWYERS };
  }

  if (key.includes('дирекц') || key.includes('руковод')) {
    return { kind: 'department', department: 'Дирекция' };
  }

  const canonical = normalizeDepartment(unitName.trim());
  if (canonical) {
    return { kind: 'department', department: canonical };
  }

  return { kind: 'department', department: unitName.trim() };
}

function nameKeySet(names: readonly string[]): Set<string> {
  return new Set(names.map((n) => normalizeEmployeeNameKey(n)));
}

function findByName(employees: readonly Employee[], name: string): Employee | undefined {
  const key = normalizeEmployeeNameKey(name);
  return employees.find((e) => normalizeEmployeeNameKey(e.name) === key);
}

function sortByName(list: Employee[]): Employee[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function fromEmployee(emp: Employee): OrgRosterPerson {
  return {
    key: `emp-${emp.id}`,
    name: emp.name,
    title: emp.title || undefined,
    openCard: true,
    employee: emp
  };
}

function fromContractor(row: { name: string; title?: string }, index: number): OrgRosterPerson {
  return {
    key: `contractor-${normalizeEmployeeNameKey(row.name) || index}`,
    name: row.name,
    title: row.title,
    openCard: false
  };
}

/** Короткая подпись секции без префикса «Digital / ». */
function sectionLabel(raw: string): string {
  const trimmed = raw.replace(/^Digital\s*\/\s*/i, '').trim() || raw;
  if (/^Группа\s*3$/i.test(trimmed)) return 'Группа Цхай';
  return trimmed;
}

/**
 * Порядок Digital для панели оргсхемы:
 * Дирекция (Ревзина → Жукова → Громов) → Analytics → Группа Цхай → Попов → Лунин → Носков.
 */
function digitalRosterSections(employees: readonly Employee[]): OrgRosterSection[] {
  const used = new Set<number>();
  const sections: OrgRosterSection[] = [];

  const take = (emp: Employee | undefined): Employee | null => {
    if (!emp || used.has(emp.id)) return null;
    used.add(emp.id);
    return emp;
  };

  const directorate = ['Ревзина Ксения', 'Жукова Юлия', 'Громов Максим']
    .map((name) => take(findByName(employees, name)))
    .filter((row): row is Employee => Boolean(row));
  if (directorate.length) {
    sections.push({
      id: 'digital-directorate',
      label: 'Дирекция',
      people: directorate.map(fromEmployee)
    });
  }

  for (const def of DIGITAL_VACATION_GROUP_DEFS_EXPORT) {
    if (def.id === 'digital-directorate' || def.id === 'digital-gromov') continue;

    let members: Employee[] = [];

    if (def.type === 'explicit') {
      members = def.memberNames
        .map((name) => take(findByName(employees, name)))
        .filter((row): row is Employee => Boolean(row));
    } else {
      const lead = findByName(employees, def.leadName);
      const reports = employees.filter(
        (e) =>
          e.department.trim() === 'Digital' &&
          normalizeEmployeeNameKey(e.manager || '') === normalizeEmployeeNameKey(def.leadName) &&
          normalizeEmployeeNameKey(e.name) !== normalizeEmployeeNameKey(def.leadName)
      );
      members = [take(lead), ...sortByName(reports).map((e) => take(e))].filter(
        (row): row is Employee => Boolean(row)
      );
    }

    if (!members.length) continue;
    sections.push({
      id: def.id,
      label: sectionLabel(def.label),
      people: members.map(fromEmployee)
    });
  }

  const leftovers = employees.filter(
    (e) => e.department.trim() === 'Digital' && e.name.trim() && !used.has(e.id)
  );
  if (leftovers.length) {
    sections.push({
      id: 'digital-other',
      label: 'Прочие',
      people: sortByName(leftovers).map(fromEmployee)
    });
  }

  return sections;
}

function flatSection(id: string, label: string, people: OrgRosterPerson[]): OrgRosterSection[] {
  if (!people.length) return [];
  return [{ id, label, people }];
}

function seoAccountingEmployees(employees: readonly Employee[]): Employee[] {
  return SEO_ACCOUNTING_NAMES.map((name) => findByName(employees, name)).filter(
    (row): row is Employee => Boolean(row)
  );
}

function seoOrmEmployees(employees: readonly Employee[]): Employee[] {
  const mgrKey = normalizeEmployeeNameKey(ORM_MANAGER);
  const lead = findByName(employees, ORM_MANAGER);
  const reports = employees.filter(
    (e) =>
      e.department.trim() === 'SEO / ORM' &&
      e.name.trim() &&
      normalizeEmployeeNameKey(e.name) !== mgrKey &&
      normalizeEmployeeNameKey(e.manager || '') === mgrKey
  );
  return [...(lead ? [lead] : []), ...sortByName(reports)];
}

function seoCoreEmployees(employees: readonly Employee[]): Employee[] {
  const accountingKeys = nameKeySet(SEO_ACCOUNTING_NAMES);
  const ormLeadKey = normalizeEmployeeNameKey(ORM_MANAGER);
  const seoLeadKey = normalizeEmployeeNameKey(SEO_MANAGER);
  const lead = findByName(employees, SEO_MANAGER);
  const reports = employees.filter((e) => {
    if (e.department.trim() !== 'SEO / ORM' || !e.name.trim()) return false;
    const selfKey = normalizeEmployeeNameKey(e.name);
    if (accountingKeys.has(selfKey)) return false;
    if (selfKey === ormLeadKey) return false;
    if (selfKey === seoLeadKey) return false;
    return normalizeEmployeeNameKey(e.manager || '') === seoLeadKey;
  });
  return [...(lead ? [lead] : []), ...sortByName(reports)];
}

/** Общий список SEO&SERM — секции с подписями, как у Digital. */
function seoSermRosterSections(employees: readonly Employee[]): OrgRosterSection[] {
  const sections: OrgRosterSection[] = [];
  const accounting = seoAccountingEmployees(employees);
  if (accounting.length) {
    sections.push({
      id: 'seo-accounting',
      label: 'Аккаунтинг',
      people: accounting.map(fromEmployee)
    });
  }
  const orm = seoOrmEmployees(employees);
  if (orm.length) {
    sections.push({
      id: 'seo-orm',
      label: 'ORM',
      people: orm.map(fromEmployee)
    });
  }
  const seo = seoCoreEmployees(employees);
  if (seo.length) {
    sections.push({
      id: 'seo-core',
      label: 'SEO',
      people: seo.map(fromEmployee)
    });
  }
  return sections;
}

/**
 * Секции списка для панели оргсхемы.
 */
export function rosterSectionsForOrgUnitName(
  unitName: string,
  employees: readonly Employee[]
): OrgRosterSection[] {
  const rule = matchRule(unitName);
  if (!rule || rule.kind === 'none') return [];

  if (rule.kind === 'digital-all') {
    return digitalRosterSections(employees);
  }

  if (rule.kind === 'seo-serm-all') {
    return seoSermRosterSections(employees);
  }

  if (rule.kind === 'department') {
    const dept = rule.department;
    const list = sortByName(
      employees.filter((e) => {
        const d = e.department.trim();
        return (d === dept || normalizeDepartment(d) === dept) && e.name.trim();
      })
    );
    return flatSection(`dept-${dept}`, unitName.trim() || dept, list.map(fromEmployee));
  }

  if (rule.kind === 'by-managers') {
    const sections: OrgRosterSection[] = [];
    const used = new Set<number>();
    for (const mgr of rule.managers) {
      const mgrKey = normalizeEmployeeNameKey(mgr);
      const lead = findByName(employees, mgr);
      const reports = employees.filter((e) => {
        if (!e.name.trim()) return false;
        if (rule.department && e.department.trim() !== rule.department) return false;
        if (normalizeEmployeeNameKey(e.manager || '') !== mgrKey) return false;
        if (normalizeEmployeeNameKey(e.name) === mgrKey) return false;
        return true;
      });
      const members = [...(lead ? [lead] : []), ...sortByName(reports)].filter((e) => {
        if (used.has(e.id)) return false;
        used.add(e.id);
        return true;
      });
      if (!members.length) continue;
      const surname = mgr.split(/\s+/)[0] ?? mgr;
      sections.push({
        id: `mgr-${mgrKey}`,
        label: `Группа · ${surname}`,
        people: members.map(fromEmployee)
      });
    }
    return sections;
  }

  if (rule.kind === 'by-names') {
    const keys = nameKeySet(rule.names);
    const list = rule.names
      .map((name) => findByName(employees, name))
      .filter((row): row is Employee => Boolean(row) && keys.has(normalizeEmployeeNameKey(row.name)));
    return flatSection('named', unitName.trim() || 'Сотрудники', list.map(fromEmployee));
  }

  if (rule.kind === 'seo-core') {
    return flatSection(
      'seo-core',
      unitName.trim() || 'SEO',
      seoCoreEmployees(employees).map(fromEmployee)
    );
  }

  if (rule.kind === 'contractors') {
    return flatSection(
      'contractors',
      unitName.trim() || 'Подрядчики',
      rule.people.map((row, i) => fromContractor(row, i))
    );
  }

  return [];
}

/** Плоский список штатных сотрудников (с карточкой). */
export function employeesForOrgUnitName(
  unitName: string,
  employees: readonly Employee[]
): Employee[] {
  return rosterSectionsForOrgUnitName(unitName, employees)
    .flatMap((s) => s.people)
    .filter((p) => p.openCard && p.employee)
    .map((p) => p.employee!);
}
