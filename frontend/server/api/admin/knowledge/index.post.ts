import { requireRole } from '../../../utils/requireRole';
import { mutateKnowledgeArticles, type KnowledgeArticle } from '../../../utils/knowledgeArticlesStore';
import { normalizeDepartmentList } from '../../../utils/knowledgeAudience';

type CreateArticleBody = {
  title?: string;
  summary?: string;
  body?: string;
  tags?: string[];
  departments?: string[];
};

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin']);
  const payload = (await readBody<CreateArticleBody>(event)) || {};

  const title = String(payload.title || '').trim();
  const summary = String(payload.summary || '').trim();
  const body = String(payload.body || '').trim();
  const status = 'review' as const;
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
      status,
      createdAt: now,
      updatedAt: now,
      authorName: session.name || session.email || 'Администратор'
    };
    created = article;
    return {
      articles: [article, ...state.articles],
      nextId: state.nextId + 1
    };
  });

  if (!created) throw createError({ statusCode: 500, statusMessage: 'Не удалось создать статью' });
  const { scheduleKnowledgeRagRebuild } = await import('../../../utils/knowledgeRag');
  scheduleKnowledgeRagRebuild();
  return { article: created, articles: next.articles };
});
