import { requireVbiSession } from '../../../../utils/session';
import {
  mutateKnowledgeArticles,
  type KnowledgeArticle
} from '../../../../utils/knowledgeArticlesStore';
import { isKnowledgeArticleAuthor, notifyKnowledgeArticleEvent } from '../../../../utils/knowledgeNotifications';

const plainText = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

/** Отправить на проверку руководителю (новая статья или правка опубликованной). */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const articleId = getRouterParam(event, 'id');
  if (!articleId) throw createError({ statusCode: 400, statusMessage: 'Не указан id статьи' });

  const now = new Date().toISOString();
  let updatedArticle: KnowledgeArticle | null = null;

  await mutateKnowledgeArticles(async (state) => {
    const index = state.articles.findIndex((item) => item.id === articleId);
    if (index < 0) throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });

    const current = state.articles[index];
    if (!(await isKnowledgeArticleAuthor(session, current))) {
      throw createError({ statusCode: 403, statusMessage: 'Можно отправлять только свои статьи' });
    }
    if (current.status === 'rejected') {
      throw createError({ statusCode: 400, statusMessage: 'Отклонённая статья закрыта навсегда' });
    }
    if (current.status === 'pending_review') {
      throw createError({ statusCode: 400, statusMessage: 'Уже на проверке' });
    }
    if (current.status === 'published' && current.pendingRevision?.status === 'pending_review') {
      throw createError({ statusCode: 400, statusMessage: 'Правка уже на проверке' });
    }

    let updated: KnowledgeArticle;

    if (current.status === 'published') {
      const rev = current.pendingRevision;
      if (!rev) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Сначала сохраните правку опубликованной статьи'
        });
      }
      if (plainText(rev.body).length < 20 || rev.title.trim().length < 3) {
        throw createError({ statusCode: 400, statusMessage: 'Правка слишком короткая' });
      }
      updated = {
        ...current,
        pendingRevision: {
          ...rev,
          submittedAt: now,
          status: 'pending_review'
        },
        submittedAt: now,
        updatedAt: now
      };
    } else {
      if (plainText(current.body).length < 20 || current.title.trim().length < 3) {
        throw createError({ statusCode: 400, statusMessage: 'Статья слишком короткая' });
      }
      if (current.status !== 'draft' && current.status !== 'revision_requested') {
        throw createError({ statusCode: 400, statusMessage: 'Нельзя отправить в этом статусе' });
      }
      updated = {
        ...current,
        status: 'pending_review',
        submittedAt: now,
        updatedAt: now
      };
    }

    updatedArticle = updated;
    const articles = [...state.articles];
    articles[index] = updated;
    return { ...state, articles };
  });

  if (!updatedArticle) throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });

  await notifyKnowledgeArticleEvent({
    event: 'submitted',
    article: updatedArticle,
    authorSession: session
  });

  return { article: updatedArticle };
});
