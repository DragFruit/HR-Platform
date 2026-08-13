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

const articleText = (card: KnowledgeCard) =>
  [card.title, card.description, card.category, card.author ?? '', ...(card.body ?? [])].join('\n');

const matchesRequired = (card: KnowledgeCard, parsed: ParsedKnowledgeQuery) => {
  const hay = articleText(card);
  const hayLower = hay.toLowerCase();

  for (const phrase of parsed.phrases) {
    if (!hayLower.includes(phrase.toLowerCase())) return false;
  }
  for (const word of parsed.exact) {
    if (!hasExactWord(hay, word)) return false;
  }
  for (const group of parsed.orGroups) {
    const ok = group.some((word) => hayLower.includes(word.toLowerCase()));
    if (!ok) return false;
  }
  return true;
};

const scoreCard = (card: KnowledgeCard, parsed: ParsedKnowledgeQuery) => {
  const title = card.title.toLowerCase();
  const body = [card.description, ...(card.body ?? [])].join('\n').toLowerCase();
  let score = 0;

  for (const phrase of parsed.phrases) {
    const needle = phrase.toLowerCase();
    if (title.includes(needle)) score += 12;
    else if (body.includes(needle)) score += 6;
  }
  for (const word of parsed.exact) {
    if (hasExactWord(card.title, word)) score += 10;
    else score += 5;
  }
  for (const word of parsed.soft) {
    const needle = word.toLowerCase();
    if (title.includes(needle)) score += 5;
    else if (body.includes(needle)) score += 2;
  }
  for (const group of parsed.orGroups) {
    if (group.some((word) => title.includes(word.toLowerCase()))) score += 5;
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
