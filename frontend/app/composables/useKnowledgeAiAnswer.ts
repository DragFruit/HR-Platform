import type { KnowledgeCard } from '~/data/knowledgeBaseCatalog';
import {
  detectKbAiChitchat,
  detectKbAiClarify,
  detectKbAiOfftopic,
  KB_AI_CHITCHAT_REPLY,
  KB_AI_CLARIFY_REPLY,
  KB_AI_OFFTOPIC_REPLY,
  parseKbAiModelReply
} from '~/utils/knowledgeAiIntent';
import { pickKnowledgeCardsForAi } from '~/utils/knowledgeSearch';

/**
 * Для ответов по статьям цитаты обязательны.
 * Исключение: chitchat / offtopic / clarify — без ссылок на статьи.
 */
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
  /** Без «Ещё по теме» */
  mode?: 'kb' | 'chitchat' | 'offtopic' | 'clarify';
};

const asCite = (card: KnowledgeCard): KnowledgeAiCite => ({
  id: card.id,
  title: card.title
});

const textOnlyAnswer = (
  text: string,
  mode: 'chitchat' | 'offtopic' | 'clarify'
): KnowledgeAiAnswer => ({
  parts: [{ type: 'text', value: text }],
  citations: [],
  mode
});

/** Только релевантные хиты. Без запасной «рандомной» статьи — иначе «мяу» тянет AFINA. */
const pickSourceCards = (question: string, pool: KnowledgeCard[]): KnowledgeCard[] =>
  pickKnowledgeCardsForAi(pool, question, 3);

/** Текст ответа + пустая строка + «Ещё по теме:» и кликабельные статьи через запятую. */
const appendRelatedTopicCites = (parts: KnowledgeAiPart[], cards: KnowledgeCard[]) => {
  if (!cards.length) return;
  parts.push({ type: 'text', value: '\n\nЕщё по теме: ' });
  cards.forEach((card, idx) => {
    if (idx > 0) parts.push({ type: 'text', value: ', ' });
    parts.push({ type: 'cite', id: card.id, title: card.title });
  });
};

const buildParts = (_question: string, cards: KnowledgeCard[]): KnowledgeAiPart[] => {
  const first = cards[0];
  if (!first) {
    throw new Error('KB_AI_CITE_REQUIRED: нет статей, ответ строить нельзя');
  }
  const lead = first.body?.[0] ?? first.description ?? 'В базе есть материал по этому вопросу.';
  const parts: KnowledgeAiPart[] = [{ type: 'text', value: lead.replace(/\s+$/, '') }];
  appendRelatedTopicCites(parts, cards);
  return parts;
};

const buildContextFromCards = (cards: KnowledgeCard[]) => {
  const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&\w+;/g, ' ');

  const chunks = cards.map((card, idx) => {
    const fromBody = (card.body ?? []).join('\n');
    const fromHtml = card.bodyHtml ?? '';
    const text = [fromBody, stripHtml(fromHtml)].filter(Boolean).join('\n').trim();
    const limited = text.length > 4000 ? `${text.slice(0, 4000)}\n\n[обрезано]` : text;
    return `[${idx + 1}] ${card.title}\n${limited}`;
  });

  const joined = chunks.join('\n\n');
  return joined.length > 12000 ? `${joined.slice(0, 12000)}\n\n[обрезано]` : joined;
};

const buildPartsFromModel = (modelAnswer: string, cards: KnowledgeCard[]): KnowledgeAiPart[] => {
  if (!cards[0]) throw new Error('KB_AI_CITE_REQUIRED: нет статей, ответ строить нельзя');

  const parts: KnowledgeAiPart[] = [
    { type: 'text', value: modelAnswer.trim() || leadFallback(cards) }
  ];
  appendRelatedTopicCites(parts, cards);
  return parts;
};

const leadFallback = (cards: KnowledgeCard[]) => cards[0]?.description ?? 'В базе есть материал по этому вопросу.';

export function assertKnowledgeAiCitations(answer: KnowledgeAiAnswer): KnowledgeAiAnswer {
  if (!KB_AI_CITE_REQUIRED) {
    throw new Error('KB_AI_CITE_REQUIRED нельзя выключать');
  }
  if (answer.mode === 'chitchat' || answer.mode === 'offtopic' || answer.mode === 'clarify') {
    return answer;
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
  const { articles } = useKnowledgeArticles();

  const answerQuestion = async (question: string): Promise<KnowledgeAiAnswer> => {
    if (detectKbAiChitchat(question)) {
      return assertKnowledgeAiCitations(textOnlyAnswer(KB_AI_CHITCHAT_REPLY, 'chitchat'));
    }
    if (detectKbAiClarify(question)) {
      return assertKnowledgeAiCitations(textOnlyAnswer(KB_AI_CLARIFY_REPLY, 'clarify'));
    }
    if (detectKbAiOfftopic(question)) {
      return assertKnowledgeAiCitations(textOnlyAnswer(KB_AI_OFFTOPIC_REPLY, 'offtopic'));
    }

    const cards = pickSourceCards(question, articles.value);
    if (!cards.length) {
      // Нет релевантных статей — как оффтоп/бессмыслица, без выдуманного контекста
      return assertKnowledgeAiCitations(textOnlyAnswer(KB_AI_OFFTOPIC_REPLY, 'offtopic'));
    }

    const citations = cards.map(asCite);
    let parts = buildParts(question, cards);
    let mode: KnowledgeAiAnswer['mode'] = 'kb';

    try {
      const context = buildContextFromCards(cards);
      const resp = await $fetch<{ answer: string }>('/api/knowledge/yandex-ask', {
        method: 'POST',
        body: { question, context }
      });

      if (resp?.answer?.trim()) {
        const parsed = parseKbAiModelReply(resp.answer);
        if (parsed.intent === 'chitchat') {
          return assertKnowledgeAiCitations(textOnlyAnswer(parsed.text || KB_AI_CHITCHAT_REPLY, 'chitchat'));
        }
        if (parsed.intent === 'offtopic') {
          return assertKnowledgeAiCitations(textOnlyAnswer(parsed.text || KB_AI_OFFTOPIC_REPLY, 'offtopic'));
        }
        if (parsed.intent === 'clarify') {
          return assertKnowledgeAiCitations(textOnlyAnswer(parsed.text || KB_AI_CLARIFY_REPLY, 'clarify'));
        }
        parts = buildPartsFromModel(parsed.text, cards);
        mode = 'kb';
      }
    } catch (err) {
      console.warn('[knowledge-ai] yandex-ask failed, using template answer', err);
    }

    return assertKnowledgeAiCitations({ parts, citations, mode });
  };

  return { answerQuestion };
}
