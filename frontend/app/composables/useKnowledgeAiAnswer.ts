import {
  detectKbAiChitchat,
  detectKbAiClarify,
  detectKbAiOfftopic,
  emptyKbReplyMode,
  isKbClarifyingFollowUp,
  KB_AI_CHITCHAT_REPLY,
  KB_AI_CLARIFY_REPLY,
  KB_AI_GREETING_REPLY,
  KB_AI_NOT_FOUND_REPLY,
  KB_AI_OFFTOPIC_REPLY,
  parseKbAiModelReply,
  shouldRejectModelOfftopic
} from '~/utils/knowledgeAiIntent';

/**
 * Для ответов по статьям цитаты обязательны.
 * Исключение: chitchat / offtopic / clarify / not_found — без ссылок на статьи.
 */
export const KB_AI_CITE_REQUIRED = true;

export type KnowledgeAiCite = {
  id: string;
  title: string;
  /** Если задан — ссылка не на статью `/knowledge/:id`, а на путь платформы (напр. Структура). */
  href?: string;
};

export type KnowledgeAiPerson = {
  name: string;
  href: string;
};

export type KnowledgeAiPart =
  | { type: 'text'; value: string }
  | { type: 'cite'; id: string; title: string; href?: string }
  | { type: 'person'; name: string; href: string };

export type KnowledgeAiAnswer = {
  parts: KnowledgeAiPart[];
  citations: KnowledgeAiCite[];
  /** Без «Ещё по теме» */
  mode?: 'kb' | 'chitchat' | 'offtopic' | 'clarify' | 'not_found' | 'org';
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
    parts.push({ type: 'cite', id: cite.id, title: cite.title, href: cite.href });
  });
};

/** Вставляет квадратик Bitrix сразу после ФИО в тексте ответа. */
export function partsWithInlinePeople(
  text: string,
  people: KnowledgeAiPerson[]
): KnowledgeAiPart[] {
  const unique = people
    .filter((p) => p.name.trim() && p.href.trim())
    .sort((a, b) => b.name.length - a.name.length);
  if (!unique.length) return [{ type: 'text', value: text }];

  const parts: KnowledgeAiPart[] = [];
  let rest = text;
  const used = new Set<string>();

  while (rest.length) {
    let bestIdx = -1;
    let best: KnowledgeAiPerson | null = null;
    for (const person of unique) {
      if (used.has(person.name)) continue;
      const idx = rest.indexOf(person.name);
      if (idx < 0) continue;
      if (bestIdx < 0 || idx < bestIdx) {
        bestIdx = idx;
        best = person;
      }
    }
    if (!best || bestIdx < 0) {
      parts.push({ type: 'text', value: rest });
      break;
    }
    if (bestIdx > 0) parts.push({ type: 'text', value: rest.slice(0, bestIdx) });
    parts.push({ type: 'text', value: best.name });
    parts.push({ type: 'person', name: best.name, href: best.href });
    used.add(best.name);
    rest = rest.slice(bestIdx + best.name.length);
  }

  return parts;
}

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
  const inlineCites = answer.parts.filter((part) => part.type === 'cite');
  const inlinePeople = answer.parts.filter((part) => part.type === 'person');
  if (answer.mode === 'org') {
    if (!inlineCites.length && !inlinePeople.length) {
      throw new Error('KB_AI_CITE_REQUIRED: org-ответ без Структуры/Bitrix запрещён');
    }
    return answer;
  }
  if (!inlineCites.length || !answer.citations.length) {
    throw new Error('KB_AI_CITE_REQUIRED: ответ без ссылок на статьи запрещён');
  }
  const ids = new Set(answer.citations.map((cite) => cite.id));
  for (const part of inlineCites) {
    if (part.type !== 'cite') continue;
    if (!ids.has(part.id) || !part.title.trim()) {
      throw new Error('KB_AI_CITE_REQUIRED: ссылка должна указывать на конкретную статью');
    }
  }
  return answer;
}

type YandexAskResponse = {
  answer?: string;
  citations?: KnowledgeAiCite[];
  people?: KnowledgeAiPerson[];
  found?: boolean;
  degraded?: boolean;
  intent?: 'offtopic' | 'not_found' | 'kb' | 'chitchat' | 'clarify' | 'org';
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
    // Оффтоп до API — только если это не уточнение в живом диалоге по базе
    if (
      detectKbAiOfftopic(question) &&
      !(isKbClarifyingFollowUp(question) && history.length > 0)
    ) {
      return assertKnowledgeAiCitations(textOnlyAnswer(KB_AI_OFFTOPIC_REPLY, 'offtopic'));
    }

    try {
      const resp = await $fetch<YandexAskResponse>('/api/knowledge/yandex-ask', {
        method: 'POST',
        body: { question, history: history.slice(-6) }
      });

      const citations = (resp.citations ?? [])
        .map((c) => ({
          id: String(c.id || '').trim(),
          title: String(c.title || '').trim(),
          ...(c.href ? { href: String(c.href).trim() } : {})
        }))
        .filter((c) => c.id && c.title);

      const people = (resp.people ?? [])
        .map((p) => ({ name: String(p.name || '').trim(), href: String(p.href || '').trim() }))
        .filter((p) => p.name && p.href);

      if (resp.found === false || (!citations.length && !people.length)) {
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
      // RAG нашёл статьи, а модель сказала OFFTOPIC на уточнении («ещё другие») — не отказывать
      if (
        parsed.intent === 'offtopic' &&
        shouldRejectModelOfftopic(question, history, { hasKbContext: true })
      ) {
        const fallback =
          parsed.text && !/только\s+по\s+базе\s+знаний/i.test(parsed.text)
            ? parsed.text
            : 'В найденном фрагменте базы больше пунктов по этому уточнению нет. Откройте статью в «Ещё по теме» — там полный список.';
        const parts = partsWithInlinePeople(fallback, people);
        appendRelatedTopicCites(parts, citations);
        return assertKnowledgeAiCitations({ parts, citations, mode: 'kb' });
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

      const parts = partsWithInlinePeople(parsed.text, people);
      appendRelatedTopicCites(parts, citations);
      const mode = resp.intent === 'org' || people.length ? 'org' : 'kb';
      return assertKnowledgeAiCitations({ parts, citations, mode });
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
