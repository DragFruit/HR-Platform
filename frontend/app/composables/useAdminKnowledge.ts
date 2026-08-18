export type AdminKnowledgeArticleStatus = 'draft' | 'published';

export type AdminKnowledgeArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  status: AdminKnowledgeArticleStatus;
  createdAt: string;
  updatedAt: string;
  authorName: string;
};

type AdminKnowledgePayload = {
  articles: AdminKnowledgeArticle[];
};

type UpsertInput = {
  title: string;
  summary: string;
  body: string;
  tags: string[];
  status: AdminKnowledgeArticleStatus;
};

const STATUS_LABELS: Record<AdminKnowledgeArticleStatus, string> = {
  draft: 'Черновик',
  published: 'Опубликовано'
};

export function useAdminKnowledge() {
  const articles = useState<AdminKnowledgeArticle[]>('admin-knowledge-articles', () => []);
  const hydrated = useState<boolean>('admin-knowledge-hydrated', () => false);

  const applyPayload = (payload: AdminKnowledgePayload) => {
    articles.value = Array.isArray(payload.articles)
      ? [...payload.articles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : [];
  };

  const requireArticle = (payload: AdminKnowledgePayload & { article?: AdminKnowledgeArticle }) => {
    const article = payload.article ?? articles.value[0];
    if (!article) throw new Error('Сервер не вернул статью');
    return article;
  };

  const hydrate = async () => {
    const payload = await $fetch<AdminKnowledgePayload>('/api/admin/knowledge');
    applyPayload(payload);
    hydrated.value = true;
  };

  const createArticle = async (input: UpsertInput) => {
    const payload = await $fetch<AdminKnowledgePayload & { article: AdminKnowledgeArticle }>(
      '/api/admin/knowledge',
      {
        method: 'POST',
        body: input
      }
    );
    applyPayload(payload);
    return requireArticle(payload);
  };

  const updateArticle = async (id: string, input: UpsertInput) => {
    const payload = await $fetch<AdminKnowledgePayload & { article: AdminKnowledgeArticle }>(
      `/api/admin/knowledge/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: input
      }
    );
    applyPayload(payload);
    return requireArticle(payload);
  };

  const deleteArticle = async (id: string) => {
    const payload = await $fetch<AdminKnowledgePayload>(`/api/admin/knowledge/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    applyPayload(payload);
  };

  const statusLabel = (status: AdminKnowledgeArticleStatus) => STATUS_LABELS[status];

  return {
    articles,
    hydrated,
    hydrate,
    createArticle,
    updateArticle,
    deleteArticle,
    statusLabel
  };
}
