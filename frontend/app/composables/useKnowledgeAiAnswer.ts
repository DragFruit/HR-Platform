import { findKnowledgeCard, knowledgeArticles, type KnowledgeCard } from '~/data/knowledgeBaseCatalog';
import { parseKnowledgeQuery, searchKnowledgeArticles, emptyKnowledgeFilters } from '~/utils/knowledgeSearch';

/** Ответ ИИ без ссылок на статьи запрещён. Не обходить и не рендерить в обход хука. */
export const KB_AI_CITE_REQUIRED = true;

export type KnowledgeAiCite = {
  id: string;
  title: string;
};

export type KnowledgeAiPart =
  | { type: 'text'; value: string }
  | { type: 'cite'; id: string; title: string };

export type KnowledgeAiAnswer = {
  parts: KnowledgeAiPart[];
  citations: KnowledgeAiCite[];
};

const FALLBACK_IDS = ['kb-30878'] as const;

const asCite = (card: KnowledgeCard): KnowledgeAiCite => ({
  id: card.id,
  title: card.title
});

const pickSourceCards = (question: string): KnowledgeCard[] => {
  const ranked = searchKnowledgeArticles(knowledgeArticles(), question, emptyKnowledgeFilters());
  if (ranked.length) {
    return ranked.slice(0, 3).map((hit) => hit.card);
  }

  const parsed = parseKnowledgeQuery(question);
  const loose = parsed.soft[0] ?? parsed.exact[0] ?? parsed.phrases[0] ?? '';
  if (loose) {
    const again = searchKnowledgeArticles(knowledgeArticles(), loose, emptyKnowledgeFilters());
    if (again.length) return again.slice(0, 2).map((hit) => hit.card);
  }

  return FALLBACK_IDS.map((id) => findKnowledgeCard(id)).filter((card): card is KnowledgeCard => Boolean(card));
};

const buildParts = (question: string, cards: KnowledgeCard[]): KnowledgeAiPart[] => {
  const first = cards[0];
  if (!first) {
    throw new Error('KB_AI_CITE_REQUIRED: нет статей, ответ строить нельзя');
  }
  const lead = first.body?.[0] ?? first.description ?? 'В базе есть материал по этому вопросу.';
  const parts: KnowledgeAiPart[] = [
    { type: 'text', value: `${lead.replace(/\s+$/, '')} Это разобрано в ` },
    { type: 'cite', id: first.id, title: first.title }
  ];

  if (cards[1]) {
    parts.push({ type: 'text', value: '. Ещё по теме — ' });
    parts.push({ type: 'cite', id: cards[1].id, title: cards[1].title });
  }
  if (cards[2]) {
    parts.push({ type: 'text', value: ' и ' });
    parts.push({ type: 'cite', id: cards[2].id, title: cards[2].title });
  }

  const q = question.trim();
  if (q) {
    parts.push({
      type: 'text',
      value: `. Если нужно уточнение по «${q}» — открой статью, там полный текст.`
    });
  } else {
    parts.push({ type: 'text', value: '.' });
  }

  return parts;
};

export function assertKnowledgeAiCitations(answer: KnowledgeAiAnswer): KnowledgeAiAnswer {
  if (!KB_AI_CITE_REQUIRED) {
    throw new Error('KB_AI_CITE_REQUIRED нельзя выключать');
  }
  const inline = answer.parts.filter((part) => part.type === 'cite');
  if (!inline.length || !answer.citations.length) {
    throw new Error('KB_AI_CITE_REQUIRED: ответ без ссылок на статьи запрещён');
  }
  const ids = new Set(answer.citations.map((cite) => cite.id));
  for (const part of inline) {
    if (!ids.has(part.id) || !part.title.trim()) {
      throw new Error('KB_AI_CITE_REQUIRED: ссылка должна указывать на конкретную статью');
    }
  }
  return answer;
}

export function useKnowledgeAiAnswer() {
  const answerQuestion = (question: string): KnowledgeAiAnswer => {
    const cards = pickSourceCards(question);
    if (!cards.length) {
      throw new Error('KB_AI_CITE_REQUIRED: нет статей, ответ строить нельзя');
    }

    const citations = cards.map(asCite);
    const parts = buildParts(question, cards);
    return assertKnowledgeAiCitations({ parts, citations });
  };

  return { answerQuestion };
}
