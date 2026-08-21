import { requireRole } from '../../utils/requireRole';
import { yandexChatAnswer, yandexChatAnswerAmbiguous } from '../../utils/yandexGpt';
import {
  buildRagAmbiguousContext,
  buildRagContext,
  retrieveKnowledgeDetailed
} from '../../utils/knowledgeRag';

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
 * Спросить ИИ: подбор по общему смыслу; при сомнении — два ответа.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, ['employee', 'manager', 'hr', 'admin']);

  const payload = (await readBody<Body>(event)) || {};
  const question = String(payload.question || '').trim();
  if (!question) throw createError({ statusCode: 400, statusMessage: 'question обязателен' });
  if (question.length > 2000) {
    throw createError({ statusCode: 400, statusMessage: 'question слишком длинный (макс. 2000)' });
  }

  const retrieved = await retrieveKnowledgeDetailed(question);
  if (!retrieved.hits.length) {
    return {
      answer:
        'В базе знаний не нашлось подходящих материалов по этому вопросу. Попробуйте переформулировать или откройте вкладку «Поиск».',
      citations: [] as YandexAskCitation[],
      found: false,
      ambiguous: false
    };
  }

  if (retrieved.ambiguous && retrieved.branches.length >= 2) {
    const context = buildRagAmbiguousContext(retrieved.branches);
    const answer = await yandexChatAnswerAmbiguous(question, context);
    const citations: YandexAskCitation[] = retrieved.branches.map((b) => ({
      id: b.hit.articleId,
      title: b.hit.title
    }));
    return { answer, citations, found: true, ambiguous: true };
  }

  const context = buildRagContext(retrieved.hits);
  const answer = await yandexChatAnswer(question, context);
  const citations: YandexAskCitation[] = retrieved.hits.map((h) => ({
    id: h.articleId,
    title: h.title
  }));

  return { answer, citations, found: true, ambiguous: false };
});
