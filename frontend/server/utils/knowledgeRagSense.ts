/**
 * Разрешение двусмысленных внутренних терминов по ОБЩЕМУ смыслу вопроса.
 */

export type KnowledgeSense = {
  id: string;
  label: string;
  /** Одна или несколько статей одного смысла (напр. Bitrix-регламент + Vibe). */
  articleIds: string[];
};

export type KnowledgeSenseViewer = { role: string; department: string };

type CollisionGroup = {
  id: string;
  /** Термин-омоним в вопросе. */
  term: RegExp;
  senses: KnowledgeSense[];
  /** Сигналы → id sense. */
  signals: { senseId: string; re: RegExp }[];
};

/** Bitrix Digital + Vibe Digital — оба в ответе и в «Ещё по теме». */
export const VACATION_DIGITAL_ARTICLE_IDS = ['kb-21301', 'kb-vibe-vacations-digital'] as const;
/** Bitrix SEO + Vibe (не-Digital). */
export const VACATION_SEO_ARTICLE_IDS = ['kb-24611', 'kb-vibe-vacations-other'] as const;
/** Остальные отделы: только Vibe (Bitrix-регламента отдела нет). */
export const VACATION_OTHER_ARTICLE_IDS = ['kb-vibe-vacations-other'] as const;

const VACATION_SENSES: KnowledgeSense[] = [
  {
    id: 'vac-digital',
    label: 'отпуск в Digital',
    articleIds: [...VACATION_DIGITAL_ARTICLE_IDS]
  },
  {
    id: 'vac-seo',
    label: 'отпуск в SEO/SERM',
    articleIds: [...VACATION_SEO_ARTICLE_IDS]
  },
  {
    id: 'vac-other',
    label: 'отпуск в Vibe',
    articleIds: [...VACATION_OTHER_ARTICLE_IDS]
  }
];

const COLLISIONS: CollisionGroup[] = [
  {
    id: 'dayoff',
    term: /(day\s*offf?|dayofff?|дей\s*офф?|дейофф?)/i,
    senses: [
      { id: 'dayoff-leave', label: 'отгул', articleIds: ['kb-30077'] },
      { id: 'dayoff-saas', label: 'систему DayOFFF', articleIds: ['kb-27877'] }
    ],
    signals: [
      {
        senseId: 'dayoff-leave',
        re: /(взять|оформить|оформлен|отгул|отпроси|выходн|день\s+отдых)/i
      },
      {
        senseId: 'dayoff-saas',
        re: /(войти|вход|логин|авториз|парол|система|dayofff\.ru|проект(ы|ов)?|подключ|crm|ppc|smm)/i
      }
    ]
  },
  {
    id: 'access',
    // «как зайти в афину» без слова «доступ» — тоже этот collision
    term: /(доступ|афин|afina)/i,
    senses: [
      { id: 'access-afina', label: 'доступы к AFINA CRM', articleIds: ['kb-20520'] },
      { id: 'access-guest', label: 'гостевые доступы VBI', articleIds: ['kb-29864'] },
      {
        id: 'access-sales',
        label: 'доступы отдела продаж (Директ / ВК)',
        articleIds: ['kb-25590']
      }
    ],
    signals: [
      { senseId: 'access-afina', re: /(afina|афин)/i },
      { senseId: 'access-guest', re: /гостев/i },
      // calltouch/uis — не сюда: чаще UTM/гостевые; продажи = «отдел продаж» или Директ/ВК без гостевого
      { senseId: 'access-sales', re: /(продаж|директ|google\s*ads|таргет|(?<![a-zа-я])вк(?![a-zа-я])|вкр)/i }
    ]
  },
  {
    id: 'vacation-dept',
    term: /отпуск/i,
    senses: VACATION_SENSES,
    signals: [
      { senseId: 'vac-digital', re: /(digital|диджитал)/i },
      { senseId: 'vac-seo', re: /(seo|serm|orm)/i }
    ]
  }
];

export type SenseResolution =
  | { kind: 'none' }
  | { kind: 'clear'; groupId: string; sense: KnowledgeSense }
  | { kind: 'ambiguous'; groupId: string; senses: KnowledgeSense[] };

/** Sense отпуска по отделу сотрудника (когда в вопросе нет Digital/SEO). */
export function vacationSenseFromViewer(
  viewer?: KnowledgeSenseViewer | null
): KnowledgeSense | null {
  if (!viewer) return null;
  const dept = String(viewer.department || '').trim().toLowerCase();
  if (!dept) return null;
  if (dept === 'digital') {
    return VACATION_SENSES.find((s) => s.id === 'vac-digital') ?? null;
  }
  if (/seo|orm|serm/.test(dept)) {
    return VACATION_SENSES.find((s) => s.id === 'vac-seo') ?? null;
  }
  return VACATION_SENSES.find((s) => s.id === 'vac-other') ?? null;
}

/** Разрешить омоним по общему смыслу вопроса (первый сработавший collision). */
export function resolveQuestionSense(
  question: string,
  opts?: { viewer?: KnowledgeSenseViewer | null }
): SenseResolution {
  const q = question.trim();
  if (!q) return { kind: 'none' };

  for (const group of COLLISIONS) {
    if (!group.term.test(q)) continue;
    // «списания в afina» / комиссии — не доступы к CRM (статья kb-28468)
    if (
      group.id === 'access' &&
      /списан|комисси|прочее\s*\(?\s*ppc|доп\.?\s*расход/i.test(q) &&
      !/доступ/i.test(q)
    ) {
      continue;
    }
    const matched = group.signals.filter((s) => s.re.test(q)).map((s) => s.senseId);
    const unique = [...new Set(matched)];
    if (unique.length === 1) {
      const sense = group.senses.find((s) => s.id === unique[0]);
      if (sense) return { kind: 'clear', groupId: group.id, sense };
    }
    if (unique.length > 1) {
      // доступы: более специфичный сигнал побеждает (гостевой + Директ → гостевые, не ambiguous)
      if (group.id === 'access') {
        const priority = ['access-guest', 'access-afina', 'access-sales'];
        for (const id of priority) {
          if (!unique.includes(id)) continue;
          const sense = group.senses.find((s) => s.id === id);
          if (sense) return { kind: 'clear', groupId: group.id, sense };
        }
      }
      // отпуск: digital+seo в одном вопросе — ambiguous только этих двух
      if (group.id === 'vacation-dept') {
        return {
          kind: 'ambiguous',
          groupId: group.id,
          senses: group.senses.filter((s) => unique.includes(s.id))
        };
      }
      return { kind: 'ambiguous', groupId: group.id, senses: [...group.senses] };
    }
    // нет сигнала: отпуск — по отделу юзера (Bitrix + Vibe аудитории)
    if (group.id === 'vacation-dept') {
      const fromViewer = vacationSenseFromViewer(opts?.viewer);
      if (fromViewer) return { kind: 'clear', groupId: group.id, sense: fromViewer };
      return { kind: 'none' };
    }
    if (group.id === 'access') {
      // только «афина/afina» без доп. сигнала уже matched выше; чистое «доступы» — два частых смысла
      if (/(афин|afina)/i.test(q)) {
        const sense = group.senses.find((s) => s.id === 'access-afina');
        if (sense) return { kind: 'clear', groupId: group.id, sense };
      }
      return {
        kind: 'ambiguous',
        groupId: group.id,
        senses: group.senses.filter((s) => s.id === 'access-afina' || s.id === 'access-guest')
      };
    }
    if (group.id === 'dayoff') {
      return { kind: 'ambiguous', groupId: group.id, senses: [...group.senses] };
    }
  }
  return { kind: 'none' };
}

/** @deprecated совместимость с dayoff-only API */
export type DayoffSenseGuess = 'leave' | 'saas' | 'ambiguous' | 'none';

export function guessDayoffSense(question: string): DayoffSenseGuess {
  const r = resolveQuestionSense(question);
  if (r.kind === 'none') return 'none';
  if (r.kind === 'ambiguous' && r.groupId === 'dayoff') return 'ambiguous';
  if (r.kind === 'clear' && r.groupId === 'dayoff') {
    return r.sense.id === 'dayoff-leave' ? 'leave' : 'saas';
  }
  // другой collision — для dayoff-specific expand не трогаем
  return 'none';
}

export function dayoffAmbiguousBranches(): KnowledgeSense[] {
  return COLLISIONS.find((c) => c.id === 'dayoff')?.senses ?? [];
}

export function applySenseScoreAdjust(
  articleId: string,
  baseScore: number,
  question: string,
  opts?: { viewer?: KnowledgeSenseViewer | null }
): number {
  const r = resolveQuestionSense(question, opts);
  if (r.kind !== 'clear') return baseScore;
  const boostIds = new Set(r.sense.articleIds);
  const allIds = new Set(COLLISIONS.find((c) => c.id === r.groupId)?.senses.flatMap((s) => s.articleIds) ?? []);
  if (boostIds.has(articleId)) return baseScore + 0.22;
  if (allIds.has(articleId)) return baseScore - 0.2;
  return baseScore;
}

export function ambiguousBranchesForQuestion(
  question: string,
  opts?: { viewer?: KnowledgeSenseViewer | null }
): KnowledgeSense[] {
  const r = resolveQuestionSense(question, opts);
  if (r.kind === 'ambiguous') return r.senses;
  return [];
}

export function clearSenseForQuestion(
  question: string,
  opts?: { viewer?: KnowledgeSenseViewer | null }
): KnowledgeSense | null {
  const r = resolveQuestionSense(question, opts);
  return r.kind === 'clear' ? r.sense : null;
}

/**
 * Авито (маркетплейс) vs авто (автомобили).
 * «авто» НЕ подстрока «авито»; не путать с авторизацией / автоматикой.
 */

const AVITO_MARKETPLACE_RE =
  /(?<![а-яёa-z0-9])авито(?![а-яёa-z0-9])|(?<![a-z0-9])avito(?![a-z0-9])/iu;

/** Целое слово «авто» (не «авито», не «авторизация»). */
const AUTO_STANDALONE_RE = /(?<![а-яёa-z0-9])авто(?![а-яёa-z0-9])/iu;

/** Автотематика / автомобили / cars — без Авито. */
const AUTO_VEHICLE_RE =
  /автотематик|автомобил|автосалон|автодилер|автосервис|авторынк|(?<![а-яёa-z0-9])авто[\s-]+(кейс|сегмент|тем|ниш|рынок|клиент|реклам)|(?<![а-яёa-z0-9])(машин[аыуеой]?|транспорт)(?![а-яёa-z0-9])|(?<![a-z0-9])(cars?|automobiles?|automotive|vehicles?)(?![a-z0-9])/iu;

/** Статьи про Авито (не путать с авто-сегментом). */
export const AVITO_FOCUSED_ARTICLE_IDS = new Set(['kb-30126']);

export function mentionsAvitoMarketplace(raw: string): boolean {
  return AVITO_MARKETPLACE_RE.test(String(raw || ''));
}

/** Вопрос про авто/машины/автотематику (не про Авито). */
export function mentionsAutoVehicles(raw: string): boolean {
  const q = String(raw || '');
  if (!q.trim()) return false;
  if (AUTO_VEHICLE_RE.test(q)) return true;
  if (AUTO_STANDALONE_RE.test(q)) return true;
  return false;
}

/**
 * «авто тематика» без «авито» → не тащить статьи Авито (эмбеддинги их путают).
 */
export function shouldSuppressAvitoForAutoQuestion(raw: string): boolean {
  const q = String(raw || '');
  if (!mentionsAutoVehicles(q)) return false;
  if (mentionsAvitoMarketplace(q)) return false;
  return true;
}

export function isAvitoFocusedArticle(articleId: string, title = ''): boolean {
  if (AVITO_FOCUSED_ARTICLE_IDS.has(articleId)) return true;
  return AVITO_MARKETPLACE_RE.test(String(title || ''));
}

/** Штраф/обнуление score статьи Авито, если вопрос про автомобили. */
export function applyAvitoAutoScoreAdjust(
  articleId: string,
  title: string,
  baseScore: number,
  question: string
): number {
  if (!shouldSuppressAvitoForAutoQuestion(question)) return baseScore;
  if (!isAvitoFocusedArticle(articleId, title)) return baseScore;
  return Math.min(baseScore, 0.05);
}

/** Описание известных кейсов для доков / ответа заказчику. */
export const KNOWN_SENSE_CASES_DOC = [
  {
    term: 'дейоф / day off',
    examples: ['взять дейоф → отгул', 'войти в дейоф → SaaS DayOFFF', 'что такое дейоф → два ответа']
  },
  {
    term: 'доступ / доступы',
    examples: [
      'доступы AFINA / «как зайти в афину» → CRM kb-20520',
      'гостевые доступы (+ Директ) → kb-29864 (приоритет над продажами)',
      'доступы директ/ВК / отдела продаж → kb-25590',
      'просто «доступы» → несколько вариантов',
      'списания в afina → не доступы (регламент списаний kb-28468)'
    ]
  },
  {
    term: 'отпуск',
    examples: [
      'отпуск digital / Digital-юзер «как уйти в отпуск» → Bitrix kb-21301 + Vibe kb-vibe-vacations-digital',
      'отпуск SEO → Bitrix kb-24611 + Vibe kb-vibe-vacations-other',
      'просто «отпуск» без отдела в тексте → sense по department юзера (не чужие отделы)'
    ]
  },
  {
    term: 'авто ≠ Авито',
    examples: [
      'авто / автотематика / машины → НЕ статья Авито (kb-30126)',
      'авито / avito → маркетплейс Авито',
      'кейс по авто → сначала fallback кейсов, без ссылки на Авито-специалистов'
    ]
  }
];
