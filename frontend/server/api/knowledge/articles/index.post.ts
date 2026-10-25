import { requireVbiSession } from '../../../utils/session';
import {
  mutateKnowledgeArticles,
  type KnowledgeArticle
} from '../../../utils/knowledgeArticlesStore';
import { normalizeDepartmentList } from '../../../utils/knowledgeAudience';
import { findEmployeeForSession } from '../../../utils/employeesStore';
import { notifyKnowledgeArticleEvent } from '../../../utils/knowledgeNotifications';
import { sessionActorEmployeeId } from '../../../utils/employeesStore';

type CreateBody = {
  title?: string;
  summary?: string;
  body?: string;
  tags?: string[];
  departments?: string[];
  asDraft?: boolean;
};

const plainText = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

/** Сотрудник создаёт свою статью (черновик или сразу на проверку). */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const payload = (await readBody<CreateBody>(event)) || {};
  const title = String(payload.title || '').trim();
  const summary = String(payload.summary || '').trim();
  const body = String(payload.body || '').trim();
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20)
    : [];
  const departments = normalizeDepartmentList(payload.departments);
  const asDraft = Boolean(payload.asDraft);

  if (title.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Заголовок: минимум 3 символа' });
  }
  if (plainText(body).length < 20) {
    throw createError({ statusCode: 400, statusMessage: 'Текст статьи: минимум 20 символов' });
  }

  const emp = await findEmployeeForSession(session);
  const now = new Date().toISOString();
  let created: KnowledgeArticle | null = null;

  const next = await mutateKnowledgeArticles((state) => {
    const article: KnowledgeArticle = {
      id: `kb-${state.nextId}`,
      title,
      summary,
      body,
      tags,
      breadcrumbs: [],
      departments,
      status: asDraft ? 'draft' : 'pending_review',
      createdAt: now,
      updatedAt: now,
      authorName: emp?.name || session.name || session.email || 'Сотрудник',
      authorUserId: session.id,
      comments: [],
      pendingRevision: null,
      approvedAt: null,
      rejectionReason: null,
      submittedAt: asDraft ? null : now,
      closedAt: null
    };
    created = article;
    return {
      articles: [article, ...state.articles],
      nextId: state.nextId + 1
    };
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'knowledge:create' });

  if (!created) throw createError({ statusCode: 500, statusMessage: 'Не удалось создать статью' });

  if (!asDraft) {
    await notifyKnowledgeArticleEvent({
      event: 'submitted',
      article: created,
      authorSession: session
    });
  }

  return { article: created, articles: next.articles };
});
