export type AdminKnowledgeArticleStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'revision_requested'
  | 'rejected';

export type AdminKnowledgeArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  departments: string[];
  status: AdminKnowledgeArticleStatus;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorUserId?: number | null;
  comments?: Array<{
    id: string;
    authorUserId: number;
    authorName: string;
    quote: string;
    body: string;
    createdAt: string;
  }>;
  pendingRevision?: {
    title: string;
    summary: string;
    body: string;
    tags: string[];
    departments: string[];
    submittedAt: string;
    status: 'pending_review' | 'revision_requested';
  } | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
};

type AdminKnowledgePayload = {
  articles: AdminKnowledgeArticle[];
};

type UpsertInput = {
  title: string;
  summary: string;
  body: string;
  tags: string[];
  departments: string[];
  status: AdminKnowledgeArticleStatus;
};

const STATUS_LABELS: Record<AdminKnowledgeArticleStatus, string> = {
  draft: 'Черновик',
  pending_review: 'На проверке',
  published: 'Опубликовано',
  revision_requested: 'На доработку',
  rejected: 'Отклонено'
};

const normalizeClientStatus = (status: string | undefined): AdminKnowledgeArticleStatus => {
  if (status === 'published') return 'published';
  if (status === 'draft') return 'draft';
  if (status === 'revision_requested') return 'revision_requested';
  if (status === 'rejected') return 'rejected';
  if (status === 'pending_review' || status === 'review') return 'pending_review';
  return 'pending_review';
};

export function useAdminKnowledge() {
  const articles = useState<AdminKnowledgeArticle[]>('admin-knowledge-articles', () => []);
  const hydrated = useState<boolean>('admin-knowledge-hydrated', () => false);

  const applyPayload = (payload: AdminKnowledgePayload) => {
    articles.value = Array.isArray(payload.articles)
      ? [...payload.articles]
          .map((a) => ({ ...a, status: normalizeClientStatus(a.status as string) }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : [];
  };

  const requireArticle = (payload: AdminKnowledgePayload & { article?: AdminKnowledgeArticle }) => {
    const article = payload.article ?? articles.value[0];
    if (!article) throw new Error('Сервер не вернул статью');
    return { ...article, status: normalizeClientStatus(article.status as string) };
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

  const moderateArticle = async (
    id: string,
    action: 'accept' | 'revision' | 'reject',
    rejectionReason?: string
  ) => {
    const payload = await $fetch<AdminKnowledgePayload & { article: AdminKnowledgeArticle }>(
      `/api/admin/knowledge/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: { moderateAction: action, rejectionReason }
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

  const statusLabel = (status: AdminKnowledgeArticleStatus) =>
    STATUS_LABELS[status] || STATUS_LABELS.pending_review;

  const needsModeration = (article: AdminKnowledgeArticle) =>
    article.status === 'pending_review' ||
    Boolean(article.pendingRevision?.status === 'pending_review');

  return {
    articles,
    hydrated,
    hydrate,
    createArticle,
    updateArticle,
    moderateArticle,
    deleteArticle,
    statusLabel,
    needsModeration
  };
}
