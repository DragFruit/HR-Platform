import { requireVbiSession } from '../../utils/session';
import { filterArticlesForUser } from '../../utils/knowledgeAudience';
import { readKnowledgeArticles } from '../../utils/knowledgeArticlesStore';
import { resolveKnowledgeViewer } from '../../utils/knowledgeViewer';

/** Список опубликованных статей — только для своей аудитории (нужна сессия). */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const state = await readKnowledgeArticles();
  const published = state.articles
    .filter((a) => a.status === 'published')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const viewer = await resolveKnowledgeViewer(session);
  const articles = filterArticlesForUser(published, viewer);
  return { articles };
});
