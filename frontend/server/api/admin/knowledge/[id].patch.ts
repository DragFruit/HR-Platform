import { requireRole } from '../../../utils/requireRole';
import {
  mutateKnowledgeArticles,
  normalizeKnowledgeArticleStatus,
  type KnowledgeArticle
} from '../../../utils/knowledgeArticlesStore';
import { normalizeDepartmentList } from '../../../utils/knowledgeAudience';
import { notifyKnowledgeArticleEvent } from '../../../utils/knowledgeNotifications';

type PatchArticleBody = {
  title?: string;
  summary?: string;
  body?: string;
  tags?: string[];
  departments?: string[];
  status?: string;
  /** Модерация из админки: accept | revision | reject */
  moderateAction?: 'accept' | 'revision' | 'reject';
  rejectionReason?: string;
};

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin']);
  const articleId = getRouterParam(event, 'id');
  if (!articleId) throw createError({ statusCode: 400, statusMessage: 'Не указан id статьи' });

  const payload = (await readBody<PatchArticleBody>(event)) || {};
  const moderateAction = payload.moderateAction;
  const now = new Date().toISOString();

  // Short path: moderation buttons
  if (moderateAction === 'accept' || moderateAction === 'revision' || moderateAction === 'reject') {
    const reason = String(payload.rejectionReason || '').trim();
    if (moderateAction === 'reject' && reason.length < 3) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Укажите причину отклонения (минимум 3 символа)'
      });
    }

    let updatedArticle: KnowledgeArticle | null = null;
    let notifyEvent: 'accepted' | 'revision_requested' | 'rejected' | null = null;

    const next = await mutateKnowledgeArticles((state) => {
      const index = state.articles.findIndex((item) => item.id === articleId);
      if (index < 0) throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });
      const current = state.articles[index];

      let updated: KnowledgeArticle;
      if (moderateAction === 'accept') {
        if (current.pendingRevision) {
          const rev = current.pendingRevision;
          updated = {
            ...current,
            title: rev.title,
            summary: rev.summary,
            body: rev.body,
            tags: rev.tags,
            departments: rev.departments,
            status: 'published',
            pendingRevision: null,
            approvedAt: now,
            updatedAt: now,
            comments: [],
            rejectionReason: null,
            closedAt: null
          };
        } else {
          updated = {
            ...current,
            status: 'published',
            approvedAt: now,
            updatedAt: now,
            pendingRevision: null,
            comments: [],
            rejectionReason: null,
            closedAt: null
          };
        }
        notifyEvent = 'accepted';
      } else if (moderateAction === 'revision') {
        if (current.status === 'published' && current.pendingRevision) {
          updated = {
            ...current,
            pendingRevision: { ...current.pendingRevision, status: 'revision_requested' },
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

    if (notifyEvent === 'accepted') {
      const { scheduleKnowledgeRagRebuild } = await import('../../../utils/knowledgeRag');
      scheduleKnowledgeRagRebuild();
    }

    // Notify author only for employee-authored articles
    if (updatedArticle.authorUserId) {
      await notifyKnowledgeArticleEvent({
        event: notifyEvent,
        article: updatedArticle,
        reason: moderateAction === 'reject' ? reason : undefined
      });
    }

    return { article: updatedArticle, articles: next.articles };
  }

  const title = String(payload.title || '').trim();
  const summary = String(payload.summary || '').trim();
  const body = String(payload.body || '').trim();
  const status = normalizeKnowledgeArticleStatus(payload.status);
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20)
    : [];
  const departments = normalizeDepartmentList(payload.departments);

  const plain = body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

  if (title.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Заголовок: минимум 3 символа' });
  }
  if (plain.length < 20) {
    throw createError({ statusCode: 400, statusMessage: 'Текст статьи: минимум 20 символов' });
  }

  let updatedArticle: KnowledgeArticle | null = null;
  const next = await mutateKnowledgeArticles((state) => {
    const index = state.articles.findIndex((item) => item.id === articleId);
    if (index < 0) throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });

    const prev = state.articles[index];
    const updated: KnowledgeArticle = {
      ...prev,
      title,
      summary,
      body,
      tags,
      departments,
      status,
      updatedAt: now,
      approvedAt: status === 'published' ? prev.approvedAt || now : prev.approvedAt,
      // админ правит текст — автор статьи не меняется на админа, если уже есть authorUserId сотрудника
      authorName:
        prev.authorUserId && prev.authorUserId !== session.id
          ? prev.authorName
          : session.name || session.email || prev.authorName
    };
    updatedArticle = updated;
    const articles = [...state.articles];
    articles[index] = updated;
    return { ...state, articles };
  });

  if (!updatedArticle) throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });
  const { scheduleKnowledgeRagRebuild } = await import('../../../utils/knowledgeRag');
  scheduleKnowledgeRagRebuild();
  return { article: updatedArticle, articles: next.articles };
});
