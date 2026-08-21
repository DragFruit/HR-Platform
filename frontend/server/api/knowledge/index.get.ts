import { requireVbiSession } from '../../utils/session';
import { filterArticlesForUser } from '../../utils/knowledgeAudience';
import { readKnowledgeArticles } from '../../utils/knowledgeArticlesStore';

/** Список опубликованных статей — только для своей аудитории (нужна сессия). */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const state = await readKnowledgeArticles();
  const published = state.articles
    .filter((a) => a.status === 'published')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const articles = filterArticlesForUser(published, session);
  return { articles };
});
