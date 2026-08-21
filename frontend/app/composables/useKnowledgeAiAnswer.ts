import {
  detectKbAiChitchat,
  detectKbAiClarify,
  detectKbAiOfftopic,
  KB_AI_CHITCHAT_REPLY,
  KB_AI_CLARIFY_REPLY,
  KB_AI_OFFTOPIC_REPLY,
  parseKbAiModelReply
} from '~/utils/knowledgeAiIntent';

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

const textOnlyAnswer = (
  text: string,
  mode: 'chitchat' | 'offtopic' | 'clarify'
): KnowledgeAiAnswer => ({
  parts: [{ type: 'text', value: text }],
  citations: [],
  mode
});

/** Текст ответа + пустая строка + «Ещё по теме:» и кликабельные статьи через запятую. */
const appendRelatedTopicCites = (parts: KnowledgeAiPart[], cites: KnowledgeAiCite[]) => {
  if (!cites.length) return;
  parts.push({ type: 'text', value: '\n\nЕщё по теме: ' });
  cites.forEach((cite, idx) => {
    if (idx > 0) parts.push({ type: 'text', value: ', ' });
    parts.push({ type: 'cite', id: cite.id, title: cite.title });
  });
};

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

type YandexAskResponse = {
  answer?: string;
  citations?: KnowledgeAiCite[];
  found?: boolean;
};

export function useKnowledgeAiAnswer() {
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

    try {
      const resp = await $fetch<YandexAskResponse>('/api/knowledge/yandex-ask', {
        method: 'POST',
        body: { question }
      });

      const citations = (resp.citations ?? [])
        .map((c) => ({ id: String(c.id || '').trim(), title: String(c.title || '').trim() }))
        .filter((c) => c.id && c.title);

      if (resp.found === false || !citations.length) {
        const text =
          resp.answer?.trim() ||
          'В базе знаний не нашлось подходящих материалов по этому вопросу. Попробуйте переформулировать или откройте вкладку «Поиск».';
        // Нет подходящих статей — не offtopic («только по БЗ»), а честный «не нашли»
        return assertKnowledgeAiCitations(textOnlyAnswer(text, 'offtopic'));
      }

      const rawAnswer = String(resp.answer || '').trim();
      if (!rawAnswer) {
        throw new Error('empty yandex answer');
      }

      const parsed = parseKbAiModelReply(rawAnswer);
      if (parsed.intent === 'chitchat') {
        return assertKnowledgeAiCitations(textOnlyAnswer(parsed.text || KB_AI_CHITCHAT_REPLY, 'chitchat'));
      }
      if (parsed.intent === 'offtopic') {
        return assertKnowledgeAiCitations(textOnlyAnswer(parsed.text || KB_AI_OFFTOPIC_REPLY, 'offtopic'));
      }
      if (parsed.intent === 'clarify') {
        return assertKnowledgeAiCitations(textOnlyAnswer(parsed.text || KB_AI_CLARIFY_REPLY, 'clarify'));
      }

      const parts: KnowledgeAiPart[] = [{ type: 'text', value: parsed.text }];
      appendRelatedTopicCites(parts, citations);
      return assertKnowledgeAiCitations({ parts, citations, mode: 'kb' });
    } catch (err) {
      console.warn('[knowledge-ai] yandex-ask failed', err);
      return assertKnowledgeAiCitations(
        textOnlyAnswer(
          'Сейчас не удалось получить ответ от помощника. Попробуйте ещё раз чуть позже или воспользуйтесь вкладкой «Поиск».',
          'clarify'
        )
      );
    }
  };

  return { answerQuestion };
}
