import {
  detectKbAiChitchat,
  detectKbAiClarify,
  detectKbAiOfftopic,
  emptyKbReplyMode,
  KB_AI_CHITCHAT_REPLY,
  KB_AI_CLARIFY_REPLY,
  KB_AI_GREETING_REPLY,
  KB_AI_NOT_FOUND_REPLY,
  KB_AI_OFFTOPIC_REPLY,
  parseKbAiModelReply
} from '~/utils/knowledgeAiIntent';

/**
 * Для ответов по статьям цитаты обязательны.
 * Исключение: chitchat / offtopic / clarify / not_found — без ссылок на статьи.
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
  mode?: 'kb' | 'chitchat' | 'offtopic' | 'clarify' | 'not_found';
};

export type KnowledgeAiHistoryTurn = {
  role: 'user' | 'assistant';
  text: string;
};

const textOnlyAnswer = (
  text: string,
  mode: 'chitchat' | 'offtopic' | 'clarify' | 'not_found'
): KnowledgeAiAnswer => ({
  parts: [{ type: 'text', value: text }],
  citations: [],
  mode
});

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
  if (
    answer.mode === 'chitchat' ||
    answer.mode === 'offtopic' ||
    answer.mode === 'clarify' ||
    answer.mode === 'not_found'
  ) {
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
  degraded?: boolean;
  intent?: 'offtopic' | 'not_found' | 'kb' | 'chitchat' | 'clarify';
};

export function useKnowledgeAiAnswer() {
  const answerQuestion = async (
    question: string,
    history: KnowledgeAiHistoryTurn[] = []
  ): Promise<KnowledgeAiAnswer> => {
    if (detectKbAiChitchat(question)) {
      const t = question.trim().toLowerCase();
      const greeting =
        /^(прив|здравств|добр|хай|hello|hi)/i.test(t) || /как\s+(дела|ты|жизнь)/i.test(t);
      return assertKnowledgeAiCitations(
        textOnlyAnswer(greeting ? KB_AI_GREETING_REPLY : KB_AI_CHITCHAT_REPLY, 'chitchat')
      );
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
        body: { question, history: history.slice(-6) }
      });

      const citations = (resp.citations ?? [])
        .map((c) => ({ id: String(c.id || '').trim(), title: String(c.title || '').trim() }))
        .filter((c) => c.id && c.title);

      if (resp.found === false || !citations.length) {
        const mode =
          resp.intent === 'offtopic' || resp.intent === 'not_found'
            ? resp.intent
            : emptyKbReplyMode(question, history);
        if (mode === 'offtopic') {
          return assertKnowledgeAiCitations(textOnlyAnswer(KB_AI_OFFTOPIC_REPLY, 'offtopic'));
        }
        const text = (resp.answer || '').includes('дописать стать')
          ? KB_AI_NOT_FOUND_REPLY
          : resp.answer?.trim() || KB_AI_NOT_FOUND_REPLY;
        return assertKnowledgeAiCitations(textOnlyAnswer(text, 'not_found'));
      }

      const rawAnswer = String(resp.answer || '').trim();
      if (!rawAnswer) {
        throw new Error('empty yandex answer');
      }

      // Модель иногда клеит CTA про статьи на оффтоп — срезаем
      if (
        /дописать стать|написать HR|Админ\s*→\s*База/i.test(rawAnswer) &&
        emptyKbReplyMode(question, history) === 'offtopic'
      ) {
        return assertKnowledgeAiCitations(textOnlyAnswer(KB_AI_OFFTOPIC_REPLY, 'offtopic'));
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

      // Ответ «нет в базе» — без «Ещё по теме» (даже если RAG подсунул слабые цитаты)
      if (
        /в базе знаний\s+(пока\s+)?нет|нет информации|в базе этого нет|не нашлось|не нашёл|не нашел/i.test(
          parsed.text
        )
      ) {
        return assertKnowledgeAiCitations(textOnlyAnswer(parsed.text || KB_AI_NOT_FOUND_REPLY, 'not_found'));
      }

      const parts: KnowledgeAiPart[] = [{ type: 'text', value: parsed.text }];
      appendRelatedTopicCites(parts, citations);
      return assertKnowledgeAiCitations({ parts, citations, mode: 'kb' });
    } catch (err) {
      console.warn('[knowledge-ai] yandex-ask failed', err);
      return assertKnowledgeAiCitations(
        textOnlyAnswer(
          'Бот ушёл на перекур, но скоро вернётся. Пока ответы могут быть менее точными. Попробуйте ещё раз чуть позже или вкладку «Поиск».',
          'clarify'
        )
      );
    }
  };

  return { answerQuestion };
}
