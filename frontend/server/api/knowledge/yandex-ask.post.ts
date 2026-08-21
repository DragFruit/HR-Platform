import { requireRole } from '../../utils/requireRole';
import { yandexChatAnswer } from '../../utils/yandexGpt';
import { buildRagContext, retrieveKnowledgeByMeaning } from '../../utils/knowledgeRag';

type Body = {
  question?: string;
  /** Устарело: контекст больше не принимаем с клиента (только серверный RAG). */
  context?: string;
};

export type YandexAskCitation = {
  id: string;
  title: string;
};

/**
 * Спросить ИИ: подбор статей по смыслу на сервере → ответ модели.
 * Клиент шлёт только вопрос.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, ['employee', 'manager', 'hr', 'admin']);

  const payload = (await readBody<Body>(event)) || {};
  const question = String(payload.question || '').trim();
  if (!question) throw createError({ statusCode: 400, statusMessage: 'question обязателен' });
  if (question.length > 2000) {
    throw createError({ statusCode: 400, statusMessage: 'question слишком длинный (макс. 2000)' });
  }

  const hits = await retrieveKnowledgeByMeaning(question);
  if (!hits.length) {
    return {
      answer:
        'В базе знаний не нашлось подходящих материалов по этому вопросу. Попробуйте переформулировать или откройте вкладку «Поиск».',
      citations: [] as YandexAskCitation[],
      found: false
    };
  }

  const context = buildRagContext(hits);
  const answer = await yandexChatAnswer(question, context);
  const citations: YandexAskCitation[] = hits.map((h) => ({ id: h.articleId, title: h.title }));

  return {
    answer,
    citations,
    found: true
  };
});
