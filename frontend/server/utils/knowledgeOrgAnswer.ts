import { bitrixEmployeeProfileUrl } from '../../app/utils/bitrixProfileUrl';
import { getBitrixConfig } from './bitrixConfig';
import type { ServerEmployee } from './employeesStore';
import { readEmployees } from './employeesStore';
import { readOrgStructure } from './orgStructureStore';

/** Цитата в «Ещё по теме» → раздел Структура (не статья базы). */
export const ORG_STRUCTURE_CITE_ID = 'org-structure';

export type OrgStructureCitation = {
  id: typeof ORG_STRUCTURE_CITE_ID;
  title: string;
  href: string;
};

/** Человек в ответе — сразу квадратик Bitrix рядом с ФИО. */
export type OrgPersonLink = {
  name: string;
  href: string;
};

export type OrgStructureAnswer = {
  answer: string;
  people: OrgPersonLink[];
  citations: OrgStructureCitation[];
};

type DeptAlias = {
  aliases: string[];
  unitNames: string[];
  employeeDepartments: string[];
};

const DEPT_ALIASES: DeptAlias[] = [
  {
    aliases: ['отдел разработки', 'разработки', 'разработкой', 'разработке', 'dev', 'дев ', ' дев', 'development'],
    unitNames: ['Отдел разработки'],
    employeeDepartments: ['DEV']
  },
  {
    aliases: ['digital', 'диджитал'],
    unitNames: ['Digital отдел'],
    employeeDepartments: ['Digital']
  },
  {
    aliases: ['orm', 'serm'],
    unitNames: ['ORM отдел', 'SEO&SERM'],
    employeeDepartments: ['SEO / ORM']
  },
  {
    aliases: ['seo', 'сео'],
    unitNames: ['SEO отдел', 'SEO&SERM'],
    employeeDepartments: ['SEO / ORM']
  },
  {
    aliases: ['отдел продаж', 'продаж'],
    unitNames: ['Отдел продаж'],
    employeeDepartments: ['Отдел продаж']
  },
  {
    aliases: ['маркетинг'],
    unitNames: ['Отдел маркетинга'],
    employeeDepartments: ['Маркетинг']
  },
  {
    aliases: ['smm', 'таргет', 'influence'],
    unitNames: ['Отдел SMM & Influence & Таргета'],
    employeeDepartments: []
  },
  {
    aliases: ['контекстн', 'медийн'],
    unitNames: ['Отдел контекстной и медийной рекламы'],
    employeeDepartments: []
  },
  {
    aliases: ['аналитик'],
    unitNames: ['Отдел аналитики'],
    employeeDepartments: []
  },
  {
    aliases: ['аккаунт'],
    unitNames: ['Отдел аккаунтинга'],
    employeeDepartments: []
  },
  {
    aliases: ['внутренн'],
    unitNames: ['Отдел внутренних проектов'],
    employeeDepartments: ['Внутренние проекты']
  },
  {
    aliases: ['бухгалт'],
    unitNames: ['Бухгалтерия'],
    employeeDepartments: ['Бухгалтерия']
  },
  {
    aliases: ['hr', 'эйчар', 'кадр'],
    unitNames: ['HR-специалист'],
    employeeDepartments: []
  },
  {
    aliases: ['офис-менедж', 'офис менедж'],
    unitNames: ['Офис-менеджер'],
    employeeDepartments: []
  },
  {
    aliases: ['юрист'],
    unitNames: ['Юристы'],
    employeeDepartments: []
  }
];

const ORG_INTENT_RE =
  /(?:кто|как\s+зовут|какое?\s+фио|какой|какая).{0,60}(?:руковод|начальн|глав[аыуе]|лид(?:ер)?|head|директор|возглавл)|(?:руковод|начальн|лид(?:ер)?|директор|возглавл).{0,40}(?:отдел|дирекци|digital|диджитал|dev|дев|seo|orm|продаж|маркетинг)|(?:кто\s+в\s+отделе|состав\s+отдел|сотрудники\s+отдел|кто\s+работает\s+в)|структур[аеы].{0,40}(?:отдел|компани|агентств)|(?:генеральн\w*\s+директор|гендир|финансовый\s+директор|коммерческий\s+директор)/i;

const LEADER_ASK_RE =
  /(?:кто|как\s+зовут|какое?\s+фио|какой|какая).{0,60}(?:руковод|начальн|глав[аыуе]|лид(?:ер)?|head|директор|возглавл)|(?:руковод|начальн|лид(?:ер)?|директор|возглавл).{0,40}(?:отдел|дирекци|digital|диджитал|dev|дев|seo|orm|продаж|маркетинг)|(?:генеральн\w*\s+директор|гендир|финансовый\s+директор|коммерческий\s+директор)/i;

const MEMBERS_ASK_RE = /(?:кто\s+в\s+отделе|состав\s+отдел|сотрудники\s+отдел|кто\s+работает\s+в)/i;

/** Вопрос про конкретного человека (ФИО / фамилия в тексте). */
const PERSON_ASK_RE =
  /(?:кто\s+так(?:ой|ая)|кто\s+это|расскажи\s+(?:про|о)|кем\s+работает|где\s+работает|в\s+каком\s+отделе|должность|профиль|битрикс|bitrix|контакт)/i;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/["«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function portalUrl(): string {
  try {
    const { bitrixPortalUrl } = getBitrixConfig();
    if (bitrixPortalUrl) return bitrixPortalUrl;
  } catch {
    /* env может быть пустым локально */
  }
  return 'https://crm.vbi.ru';
}

function personLink(emp: ServerEmployee | null | undefined, displayName: string): OrgPersonLink | null {
  if (!emp) return null;
  const href = bitrixEmployeeProfileUrl(portalUrl(), emp.bitrix_user_id ?? emp.platform_user_id);
  if (!href) return null;
  return { name: displayName || emp.name, href };
}

function findEmployeeByName(name: string, employees: ServerEmployee[]): ServerEmployee | null {
  const n = normalize(name);
  if (!n) return null;
  const exact = employees.find((e) => normalize(e.name) === n);
  if (exact) return exact;
  const starts = employees.filter(
    (e) => normalize(e.name).startsWith(`${n} `) || normalize(e.name) === n
  );
  if (starts.length === 1) return starts[0];
  const contains = employees.filter((e) => {
    const en = normalize(e.name);
    return en.includes(n) || n.split(' ').every((part) => part.length > 1 && en.includes(part));
  });
  if (contains.length === 1) return contains[0];
  return null;
}

/** Найти сотрудника, чьё ФИО/фамилия явно в вопросе (длинные имена первыми). */
function findMentionedEmployee(q: string, employees: ServerEmployee[]): ServerEmployee | null {
  const ranked = [...employees].sort((a, b) => b.name.length - a.name.length);
  for (const emp of ranked) {
    const full = normalize(emp.name);
    if (full.length >= 5 && q.includes(full)) return emp;
  }
  // Уникальная фамилия (первое слово ФИО)
  const byLast = new Map<string, ServerEmployee[]>();
  for (const emp of employees) {
    const last = normalize(emp.name).split(' ')[0] || '';
    if (last.length < 4) continue;
    const list = byLast.get(last) || [];
    list.push(emp);
    byLast.set(last, list);
  }
  for (const [last, list] of byLast) {
    if (list.length !== 1) continue;
    if (q.includes(last)) return list[0];
  }
  return null;
}

export function isOrgStructureQuestion(question: string): boolean {
  const q = normalize(question);
  if (!q || q.length > 240) return false;
  if (ORG_INTENT_RE.test(q)) return true;
  // ФИО в вопросе + «кто такой / должность / …»
  if (PERSON_ASK_RE.test(q)) return true;
  return false;
}

function orgCite(href: string): OrgStructureCitation {
  return { id: ORG_STRUCTURE_CITE_ID, title: 'Структура', href };
}

function matchDeptAlias(q: string): DeptAlias | null {
  const ranked = [...DEPT_ALIASES].sort(
    (a, b) => Math.max(...b.aliases.map((x) => x.length)) - Math.max(...a.aliases.map((x) => x.length))
  );
  for (const row of ranked) {
    if (row.aliases.some((a) => q.includes(a))) return row;
  }
  return null;
}

function matchExecutiveTitle(q: string): RegExp | null {
  if (/гендир|генеральн\w*\s+директор/.test(q)) return /генеральн/i;
  if (/финансовый\s+директор/.test(q)) return /финансов/i;
  if (/коммерческий\s+директор/.test(q)) return /коммерческ/i;
  return null;
}

function enrichPersonName(shortName: string, employees: ServerEmployee[]): string {
  const n = shortName.trim();
  if (!n) return n;
  if (n.split(/\s+/).length >= 2) return n;
  const hits = employees.filter((e) => {
    const name = String(e.name || '');
    return name === n || name.startsWith(`${n} `) || name.includes(` ${n}`);
  });
  if (hits.length === 1) return String(hits[0].name);
  return n;
}

function withPerson(
  answer: string,
  displayName: string,
  employees: ServerEmployee[],
  cite: OrgStructureCitation
): OrgStructureAnswer {
  const emp = findEmployeeByName(displayName, employees);
  const link = personLink(emp, displayName);
  return {
    answer,
    people: link ? [link] : [],
    citations: [cite]
  };
}

/**
 * Ответ по оргструктуре / справочнику сотрудников.
 * Без Yandex: факты только из данных платформы.
 */
export async function tryAnswerFromOrgStructure(
  question: string,
  opts: { orgHref?: string } = {}
): Promise<OrgStructureAnswer | null> {
  const q = normalize(question);
  if (!q || q.length > 240) return null;

  const href = opts.orgHref || '/organization';
  const cite = orgCite(href);

  const org = await readOrgStructure();
  const employees = await readEmployees();

  // Сначала — вопрос про конкретного человека по ФИО в тексте
  const mentioned = findMentionedEmployee(q, employees);
  if (mentioned && (PERSON_ASK_RE.test(q) || !ORG_INTENT_RE.test(q))) {
    // Если одновременно «кто руководит отделом X» — отдел важнее, ниже обработаем
    const aliasPeek = matchDeptAlias(q);
    if (!(aliasPeek && LEADER_ASK_RE.test(q))) {
      const parts = [
        `${mentioned.name}`,
        mentioned.title ? `— ${mentioned.title}` : null,
        mentioned.department ? `(${mentioned.department})` : null
      ].filter(Boolean);
      const manager = mentioned.manager?.trim();
      const tail = manager ? ` Руководитель: ${manager}.` : '';
      const answer = `${parts.join(' ')}.${tail}`.replace(/\s+\./g, '.');
      const people: OrgPersonLink[] = [];
      const self = personLink(mentioned, mentioned.name);
      if (self) people.push(self);
      if (manager) {
        const mgr = findEmployeeByName(manager, employees);
        const mgrLink = personLink(mgr, manager);
        if (mgrLink) people.push(mgrLink);
      }
      return { answer, people, citations: [cite] };
    }
  }

  if (!isOrgStructureQuestion(question) && !mentioned) return null;
  if (!ORG_INTENT_RE.test(q) && !PERSON_ASK_RE.test(q) && !mentioned) return null;

  const execTitleRe = matchExecutiveTitle(q);
  if (execTitleRe && LEADER_ASK_RE.test(q)) {
    const exe = org.executives.find((e) => execTitleRe.test(String(e.title || '')));
    if (exe?.person?.trim()) {
      const person = enrichPersonName(exe.person, employees);
      const byTitle =
        person === exe.person.trim()
          ? employees.find((e) => execTitleRe.test(String(e.title || '')))
          : undefined;
      const full = byTitle?.name?.trim() || person;
      const title = String(exe.title || 'Руководитель').trim();
      return withPerson(`${title} — ${full}.`, full, employees, cite);
    }
    return {
      answer: 'В структуре эта роль пока не заполнена. Откройте раздел Структура.',
      people: [],
      citations: [cite]
    };
  }

  const alias = matchDeptAlias(q);
  if (!alias) {
    if (/структур/.test(q) && !LEADER_ASK_RE.test(q) && !MEMBERS_ASK_RE.test(q)) {
      return {
        answer: 'Актуальная оргструктура — в разделе Структура.',
        people: [],
        citations: [cite]
      };
    }
    // Уже обработали mentioned выше; иначе — не наш кейс
    return null;
  }

  const unit =
    alias.unitNames
      .map((name) => org.units.find((u) => u.name === name))
      .find((u) => u && String(u.head || '').trim()) ||
    alias.unitNames.map((name) => org.units.find((u) => u.name === name)).find(Boolean) ||
    org.units.find((u) => alias.unitNames.some((n) => normalize(u.name).includes(normalize(n))));

  const unitLabel = unit?.name || alias.unitNames[0] || 'отдел';

  if (MEMBERS_ASK_RE.test(q)) {
    const deps = new Set(alias.employeeDepartments.map((d) => normalize(d)));
    const members = employees
      .filter((e) => deps.has(normalize(String(e.department || ''))))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    if (members.length) {
      const names = members.map((e) => e.name);
      const people = members
        .map((e) => personLink(e, e.name))
        .filter((p): p is OrgPersonLink => Boolean(p));
      return {
        answer: `В «${unitLabel}» в справочнике: ${names.join(', ')}. Актуальная схема — в разделе Структура.`,
        people,
        citations: [cite]
      };
    }
    if (unit?.head?.trim()) {
      return withPerson(
        `В структуре у «${unitLabel}» указан руководитель ${unit.head.trim()}. Состав отдела смотрите в разделе Структура.`,
        unit.head.trim(),
        employees,
        cite
      );
    }
    return {
      answer: `Состав «${unitLabel}» смотрите в разделе Структура.`,
      people: [],
      citations: [cite]
    };
  }

  if (LEADER_ASK_RE.test(q) || /отдел/.test(q)) {
    const head = String(unit?.head || '').trim();
    if (head) {
      const person = enrichPersonName(head, employees);
      return withPerson(`Руководитель «${unitLabel}» — ${person}.`, person, employees, cite);
    }
    const deps = new Set(alias.employeeDepartments.map((d) => normalize(d)));
    const lead = employees.find((e) => {
      if (!deps.has(normalize(String(e.department || '')))) return false;
      return /руководител|director|директор/i.test(String(e.title || ''));
    });
    if (lead?.name) {
      return withPerson(`Руководитель «${unitLabel}» — ${lead.name}.`, lead.name, employees, cite);
    }
    return {
      answer: `В структуре для «${unitLabel}» руководитель пока не указан. Откройте раздел Структура.`,
      people: [],
      citations: [cite]
    };
  }

  return null;
}
