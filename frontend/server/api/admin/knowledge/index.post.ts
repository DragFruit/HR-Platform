import { requireRole } from '../../../utils/requireRole';
import { mutateKnowledgeArticles } from '../../../utils/knowledgeArticlesStore';

type CreateArticleBody = {
  title?: string;
  summary?: string;
  body?: string;
  tags?: string[];
  status?: 'draft' | 'published';
};

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin']);
  const payload = (await readBody<CreateArticleBody>(event)) || {};

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
    const article = {
      id: `kb-${state.nextId}`,
      title,
      summary,
      body,
      tags,
      status,
      createdAt: now,
      updatedAt: now,
      authorName: session.name || session.email || 'Администратор'
    };
    return {
      articles: [article, ...state.articles],
      nextId: state.nextId + 1
    };
  });

  return { articles: next.articles };
});
