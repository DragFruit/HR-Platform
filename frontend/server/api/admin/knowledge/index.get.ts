import { requireRole } from '../../../utils/requireRole';
import { readKnowledgeArticles } from '../../../utils/knowledgeArticlesStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin']);
  const state = await readKnowledgeArticles();
  return {
    articles: [...state.articles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  };
});
