import { randomUUID } from 'node:crypto';
import { requireVbiSession } from '../../../../utils/session';
import {
  articleNeedsManagerReview,
  mutateKnowledgeArticles,
  type KnowledgeArticle,
  type KnowledgeInlineComment
} from '../../../../utils/knowledgeArticlesStore';
import { canModerateKnowledgeArticle } from '../../../../utils/knowledgeNotifications';
import { sessionActorEmployeeId } from '../../../../utils/employeesStore';

type CommentBody = {
  quote?: string;
  body?: string;
};

/** Инлайн-комментарий руководителя (Word-like, не track-changes). */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const articleId = getRouterParam(event, 'id');
  if (!articleId) throw createError({ statusCode: 400, statusMessage: 'Не указан id статьи' });

  const payload = (await readBody<CommentBody>(event)) || {};
  const quote = String(payload.quote || '').trim().slice(0, 500);
  const body = String(payload.body || '').trim().slice(0, 2000);
  if (body.length < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Текст комментария обязателен' });
  }

  const now = new Date().toISOString();
  let updatedArticle: KnowledgeArticle | null = null;

  await mutateKnowledgeArticles(async (state) => {
    const index = state.articles.findIndex((item) => item.id === articleId);
    if (index < 0) throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });

    const current = state.articles[index];
    if (!(await canModerateKnowledgeArticle(session, current))) {
      throw createError({ statusCode: 403, statusMessage: 'Нет прав оставлять комментарии' });
    }
    const onReview =
      articleNeedsManagerReview(current) ||
      current.status === 'pending_review' ||
      current.status === 'revision_requested' ||
      current.pendingRevision?.status === 'revision_requested';
    if (!onReview) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Комментарии доступны только в режиме проверки'
      });
    }

    const comment: KnowledgeInlineComment = {
      id: randomUUID(),
      authorUserId: session.id,
      authorName: session.name || 'Руководитель',
      quote,
      body,
      createdAt: now
    };

    const updated: KnowledgeArticle = {
      ...current,
      comments: [...(current.comments || []), comment],
      updatedAt: now
    };
    updatedArticle = updated;
    const articles = [...state.articles];
    articles[index] = updated;
    return { ...state, articles };
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'knowledge:comment' });

  if (!updatedArticle) throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });
  return { article: updatedArticle };
});
