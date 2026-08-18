import { requireRole } from '../../../utils/requireRole';
import { mutateKnowledgeArticles } from '../../../utils/knowledgeArticlesStore';

type PatchArticleBody = {
  title?: string;
  summary?: string;
  body?: string;
  tags?: string[];
  status?: 'draft' | 'published';
};

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin']);
  const articleId = getRouterParam(event, 'id');
  if (!articleId) throw createError({ statusCode: 400, statusMessage: 'Не указан id статьи' });

  const payload = (await readBody<PatchArticleBody>(event)) || {};
  const title = String(payload.title || '').trim();
  const summary = String(payload.summary || '').trim();
  const body = String(payload.body || '').trim();
  const status = payload.status === 'published' ? 'published' : 'draft';
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20)
    : [];

  if (title.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Заголовок: минимум 3 символа' });
  }
  if (body.length < 20) {
    throw createError({ statusCode: 400, statusMessage: 'Текст статьи: минимум 20 символов' });
  }

  const now = new Date().toISOString();
  const next = await mutateKnowledgeArticles((state) => {
    const index = state.articles.findIndex((item) => item.id === articleId);
    if (index < 0) throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });

    const updated = {
      ...state.articles[index],
      title,
      summary,
      body,
      tags,
      status,
      updatedAt: now,
      authorName: session.name || session.email || state.articles[index].authorName
    };
    const articles = [...state.articles];
    articles[index] = updated;
    return { ...state, articles };
  });

  return { articles: next.articles };
});
