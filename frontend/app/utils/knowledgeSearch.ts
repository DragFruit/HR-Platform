import type { KnowledgeArticleType, KnowledgeCard } from '~/data/knowledgeBaseCatalog';

export type ParsedKnowledgeQuery = {
  phrases: string[];
  exact: string[];
  orGroups: string[][];
  soft: string[];
};

export type KnowledgeSearchFilters = {
  dateFrom: string;
  dateTo: string;
  author: string;
  topic: string;
  type: KnowledgeArticleType | '';
};

export type KnowledgeHit = {
  card: KnowledgeCard;
  score: number;
  titleParts: { text: string; hit: boolean }[];
};

export const KNOWLEDGE_PAGE_SIZE = 5;

export const emptyKnowledgeFilters = (): KnowledgeSearchFilters => ({
  dateFrom: '',
  dateTo: '',
  author: '',
  topic: '',
  type: ''
});

export const hasActiveKnowledgeFilters = (filters: KnowledgeSearchFilters) =>
  Boolean(filters.dateFrom || filters.dateTo || filters.author || filters.topic || filters.type);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ── Транслит: кириллица ↔ латиница ── */
const CYR_TO_LAT: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
};
const LAT_TO_CYR: Record<string, string> = {};
for (const [c, l] of Object.entries(CYR_TO_LAT)) {
  if (l && !LAT_TO_CYR[l]) LAT_TO_CYR[l] = c;
}
LAT_TO_CYR['zh'] = 'ж'; LAT_TO_CYR['kh'] = 'х'; LAT_TO_CYR['ts'] = 'ц';
LAT_TO_CYR['ch'] = 'ч'; LAT_TO_CYR['sh'] = 'ш'; LAT_TO_CYR['shch'] = 'щ';
LAT_TO_CYR['yu'] = 'ю'; LAT_TO_CYR['ya'] = 'я'; LAT_TO_CYR['yo'] = 'ё';

const cyrToLat = (s: string) => s.replace(/./g, (c) => CYR_TO_LAT[c] ?? c);

const latToCyr = (s: string) => {
  let result = '';
  let i = 0;
  while (i < s.length) {
    const four = s.slice(i, i + 4).toLowerCase();
    const three = s.slice(i, i + 3).toLowerCase();
    const two = s.slice(i, i + 2).toLowerCase();
    if (LAT_TO_CYR[four]) { result += LAT_TO_CYR[four]; i += 4; }
    else if (LAT_TO_CYR[three]) { result += LAT_TO_CYR[three]; i += 3; }
    else if (LAT_TO_CYR[two]) { result += LAT_TO_CYR[two]; i += 2; }
    else if (LAT_TO_CYR[s[i].toLowerCase()]) { result += LAT_TO_CYR[s[i].toLowerCase()]!; i += 1; }
    else { result += s[i]; i += 1; }
  }
  return result;
};

/* ── Раскладка: QWERTY ↔ ЙЦУКЕН (набрал не в той раскладке) ── */
const EN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>~";
const RU_KEYS = "йцукенгшщзхъфывапролджэячсмитьбюёЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮЁ";
const EN_TO_RU: Record<string, string> = {};
const RU_TO_EN: Record<string, string> = {};
for (let i = 0; i < EN_KEYS.length; i++) {
  EN_TO_RU[EN_KEYS[i]] = RU_KEYS[i];
  RU_TO_EN[RU_KEYS[i]] = EN_KEYS[i];
}
const swapLayoutToRu = (s: string) => s.replace(/./g, (c) => EN_TO_RU[c] ?? c);
const swapLayoutToEn = (s: string) => s.replace(/./g, (c) => RU_TO_EN[c] ?? c);

const isCyrillic = (s: string) => /[а-яё]/i.test(s);
const isLatin = (s: string) => /[a-z]/i.test(s);

/** Все варианты написания токена для нечёткого поиска */
const expandToken = (token: string): string[] => {
  const low = token.toLowerCase();
  const variants = new Set<string>([low]);
  if (isCyrillic(low)) {
    variants.add(cyrToLat(low));
    variants.add(swapLayoutToEn(low));
  }
  if (isLatin(low)) {
    variants.add(latToCyr(low));
    variants.add(swapLayoutToRu(low));
  }
  return [...variants];
};

const hasExactWord = (hay: string, word: string) => {
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(word)}(?![\\p{L}\\p{N}_])`, 'iu');
  return re.test(hay);
};

export function parseKnowledgeQuery(raw: string): ParsedKnowledgeQuery {
  const phrases: string[] = [];
  const rest = raw.replace(/"([^"]+)"/g, (_, phrase: string) => {
    const trimmed = phrase.trim();
    if (trimmed) phrases.push(trimmed);
    return ' ';
  });

  type Atom = { kind: 'exact' | 'word' | 'or'; value: string };
  const atoms: Atom[] = [];
  for (const token of rest.split(/\s+/).filter(Boolean)) {
    if (token.toUpperCase() === 'OR') {
      atoms.push({ kind: 'or', value: 'OR' });
      continue;
    }
    if (token.startsWith('!') && token.length > 1) {
      atoms.push({ kind: 'exact', value: token.slice(1) });
      continue;
    }
    atoms.push({ kind: 'word', value: token });
  }

  const exact: string[] = [];
  const orGroups: string[][] = [];
  const soft: string[] = [];

  let i = 0;
  while (i < atoms.length) {
    const current = atoms[i];
    if (!current || current.kind === 'or') {
      i += 1;
      continue;
    }
    if (atoms[i + 1]?.kind === 'or' && atoms[i + 2] && atoms[i + 2].kind !== 'or') {
      const group = [current.value];
      let j = i + 1;
      while (atoms[j]?.kind === 'or' && atoms[j + 1] && atoms[j + 1].kind !== 'or') {
        group.push(atoms[j + 1].value);
        j += 2;
      }
      orGroups.push(group);
      i = j;
      continue;
    }
    if (current.kind === 'exact') exact.push(current.value);
    else soft.push(current.value);
    i += 1;
  }

  return { phrases, exact, orGroups, soft };
}

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&\w+;/g, ' ');

const articleText = (card: KnowledgeCard) =>
  [card.title, card.description, card.category, card.author ?? '', ...(card.body ?? []), stripHtml(card.bodyHtml ?? '')].join('\n');

const hayIncludesAny = (hayLower: string, token: string) =>
  expandToken(token).some((v) => hayLower.includes(v));

const hayExactAny = (hay: string, token: string) =>
  expandToken(token).some((v) => hasExactWord(hay, v));

const matchesRequired = (card: KnowledgeCard, parsed: ParsedKnowledgeQuery) => {
  const hay = articleText(card);
  const hayLower = hay.toLowerCase();

  for (const phrase of parsed.phrases) {
    if (!expandToken(phrase).some((v) => hayLower.includes(v))) return false;
  }
  for (const word of parsed.exact) {
    if (!hayExactAny(hay, word)) return false;
  }
  for (const group of parsed.orGroups) {
    const ok = group.some((word) => hayIncludesAny(hayLower, word));
    if (!ok) return false;
  }
  return true;
};

const anyIncludes = (hay: string, token: string) =>
  expandToken(token).some((v) => hay.includes(v));

const scoreCard = (card: KnowledgeCard, parsed: ParsedKnowledgeQuery) => {
  const title = card.title.toLowerCase();
  const body = [card.description, ...(card.body ?? []), stripHtml(card.bodyHtml ?? '')].join('\n').toLowerCase();
  let score = 0;

  for (const phrase of parsed.phrases) {
    if (anyIncludes(title, phrase)) score += 12;
    else if (anyIncludes(body, phrase)) score += 6;
  }
  for (const word of parsed.exact) {
    if (hayExactAny(card.title, word)) score += 10;
    else score += 5;
  }
  for (const word of parsed.soft) {
    if (anyIncludes(title, word)) score += 5;
    else if (anyIncludes(body, word)) score += 2;
  }
  for (const group of parsed.orGroups) {
    if (group.some((w) => anyIncludes(title, w))) score += 5;
    else score += 2;
  }
  return score;
};

export function highlightTitle(title: string, parsed: ParsedKnowledgeQuery) {
  const terms = [...parsed.phrases, ...parsed.exact, ...parsed.soft, ...parsed.orGroups.flat()]
    .map((term) => term.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (!terms.length) return [{ text: title, hit: false }];

  const re = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'giu');
  const chunks = title.split(re).filter((chunk) => chunk !== '');
  const lowered = new Set(terms.map((term) => term.toLowerCase()));

  return chunks.map((text) => ({
    text,
    hit: lowered.has(text.toLowerCase())
  }));
}

export function applyKnowledgeFilters(cards: KnowledgeCard[], filters: KnowledgeSearchFilters) {
  return cards.filter((card) => {
    if (card.tone === 'placeholder') return false;
    if (card.visibility && card.visibility !== 'all') return false;
    if (filters.author && card.author !== filters.author) return false;
    if (filters.topic && card.category !== filters.topic) return false;
    if (filters.type && card.type !== filters.type) return false;
    if (filters.dateFrom && (card.publishedAt ?? '') < filters.dateFrom) return false;
    if (filters.dateTo && (card.publishedAt ?? '') > filters.dateTo) return false;
    return true;
  });
}

export function searchKnowledgeArticles(
  cards: KnowledgeCard[],
  rawQuery: string,
  filters: KnowledgeSearchFilters
): KnowledgeHit[] {
  const pool = applyKnowledgeFilters(cards, filters);
  const query = rawQuery.trim();
  if (!query) {
    return pool
      .slice()
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .map((card) => ({ card, score: 0, titleParts: [{ text: card.title, hit: false }] }));
  }

  const parsed = parseKnowledgeQuery(query);
  const hasRequired = parsed.phrases.length + parsed.exact.length + parsed.orGroups.length > 0;
  const hits: KnowledgeHit[] = [];

  for (const card of pool) {
    if (!matchesRequired(card, parsed)) continue;
    const score = scoreCard(card, parsed);
    if (!hasRequired && parsed.soft.length && score <= 0) continue;
    hits.push({
      card,
      score,
      titleParts: highlightTitle(card.title, parsed)
    });
  }

  return hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.card.publishedAt ?? '').localeCompare(a.card.publishedAt ?? '');
  });
}

const AI_SOFT_STOP = new Set(['и', 'в', 'на', 'по', 'для', 'как', 'что', 'это', 'или', 'из', 'к', 'о', 'об', 'а', 'но']);

/** Сколько «смысловых» слов запроса реально встречаются в статье (с учётом транслита/раскладки). */
export function countSoftTokenMatches(card: KnowledgeCard, softTokens: string[]): number {
  const hayLower = articleText(card).toLowerCase();
  let n = 0;
  for (const raw of softTokens) {
    const token = raw.trim().toLowerCase();
    if (!token || AI_SOFT_STOP.has(token) || token.length < 2) continue;
    if (hayIncludesAny(hayLower, token)) n += 1;
  }
  return n;
}

/**
 * Отбор статей для чата ИИ: строже обычного поиска страницы.
 * Обычный поиск поднимает всё, где есть хоть одно слово («контакты» в регламенте SEO) —
 * для контекста модели оставляем только хиты с несколькими совпадениями / сильным score.
 */
export function pickKnowledgeCardsForAi(cards: KnowledgeCard[], question: string, limit = 3): KnowledgeCard[] {
  const ranked = searchKnowledgeArticles(cards, question, emptyKnowledgeFilters());
  const parsed = parseKnowledgeQuery(question);
  const softMeaningful = parsed.soft
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2 && !AI_SOFT_STOP.has(t));

  const minTokenHits =
    softMeaningful.length <= 1 ? 1 : Math.min(softMeaningful.length, Math.max(2, Math.ceil(softMeaningful.length * 0.6)));
  /** Одно «контакты» в теле даёт ~2; совпадение в заголовке ≥5. */
  const minScore = softMeaningful.length <= 1 ? 2 : 5;

  const strict = ranked.filter((hit) => {
    if (hit.score < minScore) return false;
    if (softMeaningful.length <= 1) return true;
    return countSoftTokenMatches(hit.card, softMeaningful) >= minTokenHits;
  });

  if (strict.length) {
    return strict.slice(0, limit).map((hit) => hit.card);
  }

  // Мягкий откат: только лучший хит, и только если он не «одно слово в хвосте статьи»
  const top = ranked[0];
  if (top && top.score >= 5) {
    return [top.card];
  }

  return [];
}
