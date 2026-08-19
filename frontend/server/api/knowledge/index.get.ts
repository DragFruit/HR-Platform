import { readKnowledgeArticles } from '../../utils/knowledgeArticlesStore';

export default defineEventHandler(async () => {
  const state = await readKnowledgeArticles();
  const published = state.articles
    .filter((a) => a.status === 'published')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { articles: published };
});
