import { requireVbiSession } from '../../../utils/session';
import {
  articleEditableByAuthor,
  mutateKnowledgeArticles,
  type KnowledgeArticle
} from '../../../utils/knowledgeArticlesStore';
import { normalizeDepartmentList } from '../../../utils/knowledgeAudience';
import { isKnowledgeArticleAuthor } from '../../../utils/knowledgeNotifications';
import { sessionActorEmployeeId } from '../../../utils/employeesStore';

type PatchBody = {
  title?: string;
  summary?: string;
  body?: string;
  tags?: string[];
  departments?: string[];
};

const plainText = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

/** Автор правит черновик / доработку / готовит правку опубликованной. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const articleId = getRouterParam(event, 'id');
  if (!articleId) throw createError({ statusCode: 400, statusMessage: 'Не указан id статьи' });

  const payload = (await readBody<PatchBody>(event)) || {};
  const title = String(payload.title || '').trim();
  const summary = String(payload.summary || '').trim();
  const body = String(payload.body || '').trim();
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20)
    : [];
  const departments = normalizeDepartmentList(payload.departments);

  if (title.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Заголовок: минимум 3 символа' });
  }
  if (plainText(body).length < 20) {
    throw createError({ statusCode: 400, statusMessage: 'Текст статьи: минимум 20 символов' });
  }

  const now = new Date().toISOString();
  let updatedArticle: KnowledgeArticle | null = null;

  const next = await mutateKnowledgeArticles(async (state) => {
    const index = state.articles.findIndex((item) => item.id === articleId);
    if (index < 0) throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });

    const current = state.articles[index];
    if (!(await isKnowledgeArticleAuthor(session, current))) {
      throw createError({ statusCode: 403, statusMessage: 'Можно править только свои статьи' });
    }
    if (current.status === 'rejected') {
      throw createError({ statusCode: 400, statusMessage: 'Отклонённая статья закрыта навсегда' });
    }
    if (!articleEditableByAuthor(current)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Статья на проверке — редактирование недоступно'
      });
    }

    let updated: KnowledgeArticle;

    if (current.status === 'published') {
      // Правка опубликованной: пишем в pendingRevision (живая версия не меняется)
      const prevRev = current.pendingRevision;
      updated = {
        ...current,
        pendingRevision: {
          title,
          summary,
          body,
          tags,
          departments,
          submittedAt: prevRev?.submittedAt || now,
          status: 'revision_requested' // ещё не отправлено — автор дописывает
        },
        updatedAt: now
      };
    } else {
      updated = {
        ...current,
        title,
        summary,
        body,
        tags,
        departments,
        updatedAt: now,
        // очищаем комментарии только при явной новой редакции после revision? оставляем — полезны автору
      };
    }

    updatedArticle = updated;
    const articles = [...state.articles];
    articles[index] = updated;
    return { ...state, articles };
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'knowledge:edit' });

  if (!updatedArticle) throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });
  return { article: updatedArticle, articles: next.articles };
});
