import type { KnowledgeCard } from '~/data/knowledgeBaseCatalog';

type ApiArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  breadcrumbs?: string[];
  departments?: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
};

const articles = ref<KnowledgeCard[]>([]);
const hydrated = ref(false);

const toCard = (a: ApiArticle): KnowledgeCard => ({
  id: a.id,
  category: a.tags[0] ?? '',
  title: a.title,
  description: a.summary,
  author: a.authorName,
  tone: 'doc',
  type: 'regulation',
  publishedAt: a.updatedAt.slice(0, 10),
  visibility: a.departments?.length ? 'department' : 'all',
  departments: a.departments ?? [],
  bodyHtml: a.body,
  breadcrumbs: a.breadcrumbs?.length ? a.breadcrumbs : undefined
});

export function useKnowledgeArticles() {
  const hydrate = async () => {
    if (hydrated.value) return;
    try {
      const data = await $fetch<{ articles: ApiArticle[] }>('/api/knowledge');
      articles.value = (data.articles ?? []).map(toCard);
    } catch {
      articles.value = [];
    }
    hydrated.value = true;
  };

  const findArticle = (id: string) => articles.value.find((a) => a.id === id);

  return { articles, hydrated, hydrate, findArticle };
}
