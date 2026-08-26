/**
 * Разрешение двусмысленных внутренних терминов по ОБЩЕМУ смыслу вопроса.
 */

export type KnowledgeSense = {
  id: string;
  label: string;
  articleIds: string[];
};

type CollisionGroup = {
  id: string;
  /** Термин-омоним в вопросе. */
  term: RegExp;
  senses: KnowledgeSense[];
  /** Сигналы → id sense. */
  signals: { senseId: string; re: RegExp }[];
};

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
    senses: [
      { id: 'vac-digital', label: 'отпуск в Digital', articleIds: ['kb-21301'] },
      { id: 'vac-seo', label: 'отпуск в SEO/SERM', articleIds: ['kb-24611'] }
    ],
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

/** Разрешить омоним по общему смыслу вопроса (первый сработавший collision). */
export function resolveQuestionSense(question: string): SenseResolution {
  const q = question.trim();
  if (!q) return { kind: 'none' };

  for (const group of COLLISIONS) {
    if (!group.term.test(q)) continue;
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
      return { kind: 'ambiguous', groupId: group.id, senses: [...group.senses] };
    }
    // нет сигнала: для отпуска / доступов — не форсируем «два ответа» (сработает фильтр отдела / обычный RAG)
    if (group.id === 'vacation-dept') return { kind: 'none' };
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
  question: string
): number {
  const r = resolveQuestionSense(question);
  if (r.kind !== 'clear') return baseScore;
  const boostIds = new Set(r.sense.articleIds);
  const allIds = new Set(COLLISIONS.find((c) => c.id === r.groupId)?.senses.flatMap((s) => s.articleIds) ?? []);
  if (boostIds.has(articleId)) return baseScore + 0.22;
  if (allIds.has(articleId)) return baseScore - 0.2;
  return baseScore;
}

export function ambiguousBranchesForQuestion(question: string): KnowledgeSense[] {
  const r = resolveQuestionSense(question);
  if (r.kind === 'ambiguous') return r.senses;
  return [];
}

export function clearSenseForQuestion(question: string): KnowledgeSense | null {
  const r = resolveQuestionSense(question);
  return r.kind === 'clear' ? r.sense : null;
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
      'просто «доступы» → несколько вариантов'
    ]
  },
  {
    term: 'отпуск',
    examples: ['отпуск digital → регламент Digital', 'отпуск SEO → SEO/SERM', 'просто «отпуск» → два ответа (пока нет фильтра по отделу юзера в sense)']
  }
];
