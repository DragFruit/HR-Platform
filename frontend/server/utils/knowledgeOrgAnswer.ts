import { readOrgStructure } from './orgStructureStore';
import { readEmployees } from './employeesStore';

/** Цитата в «Ещё по теме» → раздел Структура (не статья базы). */
export const ORG_STRUCTURE_CITE_ID = 'org-structure';

export type OrgStructureCitation = {
  id: typeof ORG_STRUCTURE_CITE_ID;
  title: string;
  href: string;
};

export type OrgStructureAnswer = {
  answer: string;
  citations: OrgStructureCitation[];
};

type DeptAlias = {
  /** Подстроки в вопросе (уже lower). */
  aliases: string[];
  /** Имя блока в org-structure.units.name */
  unitNames: string[];
  /** Значения employees.department */
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

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/["«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function isOrgStructureQuestion(question: string): boolean {
  const q = normalize(question);
  if (!q || q.length > 240) return false;
  return ORG_INTENT_RE.test(q);
}

function orgCite(href: string): OrgStructureCitation {
  return { id: ORG_STRUCTURE_CITE_ID, title: 'Структура', href };
}

function matchDeptAlias(q: string): DeptAlias | null {
  // Более длинные алиасы первыми, чтобы «отдел разработки» победил «разработк»
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

/** Полное ФИО из справочника сотрудников, если в структуре короткое имя. */
function enrichPersonName(
  shortName: string,
  employees: { name?: string; title?: string }[]
): string {
  const n = shortName.trim();
  if (!n) return n;
  if (n.split(/\s+/).length >= 2) return n;
  const hits = employees.filter((e) => {
    const name = String(e.name || '');
    return name === n || name.startsWith(`${n} `) || name.includes(` ${n}`);
  });
  if (hits.length === 1) return String(hits[0].name);
  // Гендир и т.п. — по должности
  return n;
}

/**
 * Ответ по оргструктуре (и при необходимости справочнику сотрудников).
 * Без Yandex: факты только из данных платформы.
 */
export async function tryAnswerFromOrgStructure(
  question: string,
  opts: { orgHref?: string } = {}
): Promise<OrgStructureAnswer | null> {
  if (!isOrgStructureQuestion(question)) return null;

  const q = normalize(question);
  const href = opts.orgHref || '/organization';
  const cite = orgCite(href);

  const org = await readOrgStructure();
  const employees = await readEmployees();

  const execTitleRe = matchExecutiveTitle(q);
  if (execTitleRe && LEADER_ASK_RE.test(q)) {
    const exe = org.executives.find((e) => execTitleRe.test(String(e.title || '')));
    if (exe?.person?.trim()) {
      const person = enrichPersonName(exe.person, employees);
      // Если в структуре короткое имя — подтянуть полное из справочника по должности
      const byTitle =
        person === exe.person.trim()
          ? employees.find((e) => execTitleRe.test(String(e.title || '')))
          : undefined;
      const full = byTitle?.name?.trim() || person;
      const title = String(exe.title || 'Руководитель').trim();
      return {
        answer: `${title} — ${full}.`,
        citations: [cite]
      };
    }
    return {
      answer: 'В структуре эта роль пока не заполнена. Откройте раздел Структура.',
      citations: [cite]
    };
  }

  const alias = matchDeptAlias(q);
  if (!alias) {
    // Вопрос про структуру, но отдел не распознали — мягко отправим в раздел
    if (/структур/.test(q) && !LEADER_ASK_RE.test(q) && !MEMBERS_ASK_RE.test(q)) {
      return {
        answer: 'Актуальная оргструктура — в разделе Структура.',
        citations: [cite]
      };
    }
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
      .map((e) => String(e.name || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ru'));
    if (members.length) {
      return {
        answer: `В «${unitLabel}» в справочнике: ${members.join(', ')}. Актуальная схема — в разделе Структура.`,
        citations: [cite]
      };
    }
    if (unit?.head?.trim()) {
      return {
        answer: `В структуре у «${unitLabel}» указан руководитель ${unit.head.trim()}. Состав отдела смотрите в разделе Структура.`,
        citations: [cite]
      };
    }
    return {
      answer: `Состав «${unitLabel}» смотрите в разделе Структура.`,
      citations: [cite]
    };
  }

  if (LEADER_ASK_RE.test(q) || /отдел/.test(q)) {
    const head = String(unit?.head || '').trim();
    if (head) {
      const person = enrichPersonName(head, employees);
      return {
        answer: `Руководитель «${unitLabel}» — ${person}.`,
        citations: [cite]
      };
    }
    // Fallback: сотрудник с title руководителя в этом отделе
    const deps = new Set(alias.employeeDepartments.map((d) => normalize(d)));
    const lead = employees.find((e) => {
      if (!deps.has(normalize(String(e.department || '')))) return false;
      return /руководител|director|директор/i.test(String(e.title || ''));
    });
    if (lead?.name) {
      return {
        answer: `Руководитель «${unitLabel}» — ${lead.name}.`,
        citations: [cite]
      };
    }
    return {
      answer: `В структуре для «${unitLabel}» руководитель пока не указан. Откройте раздел Структура.`,
      citations: [cite]
    };
  }

  return null;
}
