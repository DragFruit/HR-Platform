import { requireRole } from '../../../utils/requireRole';
import { mutateKnowledgeArticles } from '../../../utils/knowledgeArticlesStore';
import { sessionActorEmployeeId } from '../../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin']);
  const articleId = getRouterParam(event, 'id');
  if (!articleId) throw createError({ statusCode: 400, statusMessage: 'Не указан id статьи' });

  const next = await mutateKnowledgeArticles((state) => {
    const exists = state.articles.some((item) => item.id === articleId);
    if (!exists) throw createError({ statusCode: 404, statusMessage: 'Статья не найдена' });
    return {
      ...state,
      articles: state.articles.filter((item) => item.id !== articleId)
    };
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'knowledge:admin-delete' });

  const { scheduleKnowledgeRagRebuild } = await import('../../../utils/knowledgeRag');
  scheduleKnowledgeRagRebuild();
  return { articles: next.articles };
});
