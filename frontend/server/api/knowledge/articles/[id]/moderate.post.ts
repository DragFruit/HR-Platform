import { requireVbiSession } from '../../../../utils/session';
import {
  mutateKnowledgeArticles,
  type KnowledgeArticle
} from '../../../../utils/knowledgeArticlesStore';
import {
  canModerateKnowledgeArticle,
  notifyKnowledgeArticleEvent
} from '../../../../utils/knowledgeNotifications';

type ModerateBody = {
  action?: 'accept' | 'revision' | 'reject';
  reason?: string;
};

/** Руководитель / admin / hr: принять, вернуть на доработку, отклонить навсегда. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const articleId = getRouterParam(event, 'id');
  if (!articleId) throw createError({ statusCode: 400, statusMessage: 'Не указан id статьи' });

  const payload = (await readBody<ModerateBody>(event)) || {};
  const action = payload.action;
  if (action !== 'accept' && action !== 'revision' && action !== 'reject') {
    throw createError({ statusCode: 400, statusMessage: 'Неизвестное действие' });
  }

  const reason = String(payload.reason || '').trim();
  if (action === 'reject' && reason.length < 3) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Укажите причину отклонения (минимум 3 символа)'
    });
  }

  const now = new Date().toISOString();
  let updatedArticle: KnowledgeArticle | null = null;
  let notifyEvent: 'accepted' | 'revision_requested' | 'rejected' | null = null;

  await mutateKnowledgeArticles(async (state) => {
    const index = state.articles.findIndex((item) => item.id === articleId);
    if (index < 0) throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });

    const current = state.articles[index];
    if (!(await canModerateKnowledgeArticle(session, current))) {
      throw createError({ statusCode: 403, statusMessage: 'Нет прав на модерацию этой статьи' });
    }
    if (current.status === 'rejected') {
      throw createError({ statusCode: 400, statusMessage: 'Статья уже отклонена' });
    }

    const awaiting =
      current.status === 'pending_review' ||
      (current.status === 'published' && current.pendingRevision?.status === 'pending_review');

    if (!awaiting && action !== 'accept') {
      // revision/reject only when awaiting; accept also for admin publishing drafts? keep strict
      throw createError({ statusCode: 400, statusMessage: 'Статья не на проверке' });
    }
    if (!awaiting && action === 'accept') {
      // allow accept from revision_requested? no — only pending
      throw createError({ statusCode: 400, statusMessage: 'Статья не на проверке' });
    }

    let updated: KnowledgeArticle;

    if (action === 'accept') {
      if (current.status === 'published' && current.pendingRevision) {
        const rev = current.pendingRevision;
        updated = {
          ...current,
          title: rev.title,
          summary: rev.summary,
          body: rev.body,
          tags: rev.tags,
          departments: rev.departments,
          pendingRevision: null,
          approvedAt: now,
          updatedAt: now,
          // автор остаётся сотрудником
          authorName: current.authorName,
          authorUserId: current.authorUserId,
          comments: []
        };
      } else {
        updated = {
          ...current,
          status: 'published',
          approvedAt: now,
          updatedAt: now,
          pendingRevision: null,
          rejectionReason: null,
          closedAt: null,
          comments: [],
          authorName: current.authorName,
          authorUserId: current.authorUserId
        };
      }
      notifyEvent = 'accepted';
    } else if (action === 'revision') {
      if (current.status === 'published' && current.pendingRevision) {
        updated = {
          ...current,
          pendingRevision: {
            ...current.pendingRevision,
            status: 'revision_requested'
          },
          updatedAt: now
        };
      } else {
        updated = {
          ...current,
          status: 'revision_requested',
          updatedAt: now
        };
      }
      notifyEvent = 'revision_requested';
    } else {
      // reject forever
      updated = {
        ...current,
        status: 'rejected',
        rejectionReason: reason,
        closedAt: now,
        updatedAt: now,
        pendingRevision: null
      };
      notifyEvent = 'rejected';
    }

    updatedArticle = updated;
    const articles = [...state.articles];
    articles[index] = updated;
    return { ...state, articles };
  });

  if (!updatedArticle || !notifyEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });
  }

  if (updatedArticle.status === 'published' || notifyEvent === 'accepted') {
    const { scheduleKnowledgeRagRebuild } = await import('../../../../utils/knowledgeRag');
    scheduleKnowledgeRagRebuild();
  }

  await notifyKnowledgeArticleEvent({
    event: notifyEvent,
    article: updatedArticle,
    reason: action === 'reject' ? reason : undefined
  });

  return { article: updatedArticle };
});
