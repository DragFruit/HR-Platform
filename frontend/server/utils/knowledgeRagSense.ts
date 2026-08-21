/**
 * Разрешение двусмысленных внутренних терминов по ОБЩЕМУ смыслу вопроса.
 * Пример: «дейоф» = и отгул (разговорно), и SaaS DayOFFF.
 */

export type KnowledgeSenseId = 'dayoff-leave' | 'dayoff-saas';

export type KnowledgeSense = {
  id: KnowledgeSenseId;
  /** Короткая подпись для «двух ответов». */
  label: string;
  articleIds: string[];
};

/** Известные «столкновения» смыслов. */
export const KNOWLEDGE_SENSES: KnowledgeSense[] = [
  {
    id: 'dayoff-leave',
    label: 'отгул',
    articleIds: ['kb-30077']
  },
  {
    id: 'dayoff-saas',
    label: 'систему DayOFFF',
    articleIds: ['kb-27877']
  }
];

const DAYOFF_TERM_RE = /(day\s*offf?|dayofff?|дей\s*офф?|дейофф?)/i;

const LEAVE_SIGNAL_RE =
  /(взять|оформить|оформлен|отгул|отпроси|выходн|день\s+отдых|взять\s+день)/i;

const SAAS_SIGNAL_RE =
  /(войти|вход|логин|авториз|парол|система|dayofff\.ru|проект(ы|ов)?|подключ|crm|ppc|smm)/i;

export type DayoffSenseGuess = 'leave' | 'saas' | 'ambiguous' | 'none';

/** Есть ли в вопросе двусмысленный «дейоф / day off». */
export function mentionsDayoffTerm(question: string): boolean {
  return DAYOFF_TERM_RE.test(question);
}

/**
 * По общему смыслу вопроса: отгул, SaaS или сомнение.
 * Без термина дейоф → none (обычный поиск).
 */
export function guessDayoffSense(question: string): DayoffSenseGuess {
  if (!mentionsDayoffTerm(question)) return 'none';
  const leave = LEAVE_SIGNAL_RE.test(question);
  const saas = SAAS_SIGNAL_RE.test(question);
  if (leave && !saas) return 'leave';
  if (saas && !leave) return 'saas';
  return 'ambiguous';
}

export function senseByGuess(guess: DayoffSenseGuess): KnowledgeSense | null {
  if (guess === 'leave') return KNOWLEDGE_SENSES.find((s) => s.id === 'dayoff-leave') ?? null;
  if (guess === 'saas') return KNOWLEDGE_SENSES.find((s) => s.id === 'dayoff-saas') ?? null;
  return null;
}

/** Обе ветки для режима «два ответа». */
export function dayoffAmbiguousBranches(): KnowledgeSense[] {
  return [...KNOWLEDGE_SENSES];
}

/**
 * Буст/штраф score статьи по угаданному смыслу.
 * clear leave → +leave articles, −saas (и наоборот).
 */
export function applySenseScoreAdjust(
  articleId: string,
  baseScore: number,
  guess: DayoffSenseGuess
): number {
  if (guess === 'none' || guess === 'ambiguous') return baseScore;
  const leaveIds = new Set(KNOWLEDGE_SENSES.find((s) => s.id === 'dayoff-leave')?.articleIds ?? []);
  const saasIds = new Set(KNOWLEDGE_SENSES.find((s) => s.id === 'dayoff-saas')?.articleIds ?? []);
  if (guess === 'leave') {
    if (leaveIds.has(articleId)) return baseScore + 0.22;
    if (saasIds.has(articleId)) return baseScore - 0.2;
  }
  if (guess === 'saas') {
    if (saasIds.has(articleId)) return baseScore + 0.22;
    if (leaveIds.has(articleId)) return baseScore - 0.2;
  }
  return baseScore;
}
