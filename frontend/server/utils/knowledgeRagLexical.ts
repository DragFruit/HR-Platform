/** Словесный слой для гибридного RAG (сервер). */

const STOP = new Set([
  'и',
  'в',
  'на',
  'по',
  'для',
  'как',
  'что',
  'это',
  'или',
  'из',
  'к',
  'о',
  'об',
  'а',
  'но',
  'не',
  'ни',
  'же',
  'ли',
  'бы',
  'то',
  'я',
  'мы',
  'вы',
  'он',
  'она',
  'они',
  'мне',
  'меня',
  'мой',
  'моя',
  'можно',
  'нужно',
  'есть',
  'быть',
  'где',
  'когда',
  'какой',
  'какая',
  'какие',
  'кто',
  'чем',
  'чтобы',
  'если',
  'уже',
  'еще',
  'ещё',
  'просто',
  'пожалуйста',
  'подскажи',
  'скажи',
  'расскажи'
]);

/** Пары/группы близких формулировок (осторожное расширение, без смены темы). */
const SYNONYM_GROUPS: string[][] = [
  // Написание SaaS (без «отгул» — смысл вопроса разбирает knowledgeRagSense)
  ['dayofff', 'day offf', 'дейофф', 'дей офф'],
  ['отгул', 'отгулы', 'оформления отгулов'],
  ['afina', 'афина', 'афину', 'афине'],
  ['vpn', 'впн'],
  ['отпуск раньше', 'аванс отпуска', 'раньше в отпуск', 'уйти раньше в отпуск'],
  ['больничный', 'больничн'],
  ['пароль', 'пароля', 'логин'],
  ['регламент отпуска', 'ухода в отпуск', 'правила отпуска']
];

/**
 * Расширение под двусмысленный «дейоф»:
 * - «взять дейоф» → +отгул
 * - «войти в дейоф» → +dayofff / система
 * - неясно → оба направления, чтобы retrieval увидел оба смысла
 */
export function expandDayoffBySense(question: string, guess: 'leave' | 'saas' | 'ambiguous' | 'none'): string {
  const q = question.trim();
  if (!q || guess === 'none') return q;
  if (guess === 'leave') return `${q} отгул оформить отгул`.replace(/\s+/g, ' ').trim();
  if (guess === 'saas') return `${q} dayofff система DayOFFF авторизация`.replace(/\s+/g, ' ').trim();
  // ambiguous: оба якоря в поисковой строке
  return `${q} отгул dayofff система DayOFFF`.replace(/\s+/g, ' ').trim();
}

export function tokenizeForRag(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

/**
 * Доля совпавших токенов + бонус за заголовок (0…1).
 * Редкое точное слово в title поднимает score сильнее.
 */
export function lexicalScore(title: string, body: string, queryTokens: string[]): number {
  if (!queryTokens.length) return 0;
  const titleL = title.toLowerCase();
  const bodyL = body.toLowerCase();
  let hits = 0;
  let titleHits = 0;
  for (const token of queryTokens) {
    if (titleL.includes(token)) {
      hits += 1;
      titleHits += 1;
    } else if (bodyL.includes(token)) {
      hits += 1;
    }
  }
  const coverage = hits / queryTokens.length;
  const titleBoost = titleHits / queryTokens.length;
  return Math.min(1, coverage * 0.75 + titleBoost * 0.45);
}

/** Добавляет синонимы к запросу, если в нём уже есть «якорь» группы. */
export function expandQueryWithSynonyms(question: string): string {
  const q = question.trim();
  if (!q) return q;
  const lower = q.toLowerCase();
  const extra: string[] = [];

  for (const group of SYNONYM_GROUPS) {
    const hit = group.some((term) => lower.includes(term.toLowerCase()));
    if (!hit) continue;
    for (const term of group) {
      if (!lower.includes(term.toLowerCase())) extra.push(term);
    }
  }

  if (!extra.length) return q;
  return `${q} ${extra.join(' ')}`.replace(/\s+/g, ' ').trim();
}

/**
 * Переформулировка безопасна, если сохраняет значимую долю исходных слов
 * и не раздувается новыми темами.
 */
export function isRewriteSafe(original: string, rewrite: string): boolean {
  const a = new Set(tokenizeForRag(original));
  const b = new Set(tokenizeForRag(rewrite));
  if (!a.size || !b.size) return false;

  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  const recall = inter / a.size;
  const precision = inter / b.size;
  if (recall < 0.4) return false;
  if (precision < 0.35 && b.size > a.size * 1.5) return false;

  const lenRatio = rewrite.trim().length / Math.max(1, original.trim().length);
  if (lenRatio < 0.4 || lenRatio > 2.5) return false;
  return true;
}
