export type KnowledgeAuthorStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'revision_requested'
  | 'rejected';

export type KnowledgeInlineComment = {
  id: string;
  authorUserId: number;
  authorName: string;
  quote: string;
  body: string;
  createdAt: string;
};

export type KnowledgePendingRevision = {
  title: string;
  summary: string;
  body: string;
  tags: string[];
  departments: string[];
  submittedAt: string;
  status: 'pending_review' | 'revision_requested';
};

export type KnowledgeAuthorArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  departments: string[];
  status: KnowledgeAuthorStatus;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorUserId: number | null;
  comments: KnowledgeInlineComment[];
  pendingRevision: KnowledgePendingRevision | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  closedAt: string | null;
};

type MinePayload = {
  own: KnowledgeAuthorArticle[];
  reports: KnowledgeAuthorArticle[];
  reviewQueue: KnowledgeAuthorArticle[];
  hasDirectReports: boolean;
};

type UpsertInput = {
  title: string;
  summary: string;
  body: string;
  tags: string[];
  departments: string[];
  asDraft?: boolean;
};

const STATUS_LABELS: Record<KnowledgeAuthorStatus, string> = {
  draft: 'Черновик',
  pending_review: 'На проверке',
  published: 'Опубликовано',
  revision_requested: 'На доработку',
  rejected: 'Отклонено'
};

export function articleNeedsReview(article: KnowledgeAuthorArticle): boolean {
  if (article.status === 'pending_review') return true;
  return Boolean(
    article.status === 'published' && article.pendingRevision?.status === 'pending_review'
  );
}

export function articleEditable(article: KnowledgeAuthorArticle): boolean {
  if (article.status === 'rejected') return false;
  if (article.status === 'pending_review') return false;
  if (article.status === 'published') {
    if (!article.pendingRevision) return true;
    return article.pendingRevision.status === 'revision_requested';
  }
  return article.status === 'draft' || article.status === 'revision_requested';
}

/** Текст для редактора: pending revision если есть, иначе основная версия. */
export function articleEditorFields(article: KnowledgeAuthorArticle) {
  const rev = article.pendingRevision;
  if (rev) {
    return {
      title: rev.title,
      summary: rev.summary,
      body: rev.body,
      tags: [...rev.tags],
      departments: [...rev.departments]
    };
  }
  return {
    title: article.title,
    summary: article.summary,
    body: article.body,
    tags: [...article.tags],
    departments: [...(article.departments ?? [])]
  };
}

export function useKnowledgeAuthor() {
  const own = useState<KnowledgeAuthorArticle[]>('kb-author-own', () => []);
  const reports = useState<KnowledgeAuthorArticle[]>('kb-author-reports', () => []);
  const reviewQueue = useState<KnowledgeAuthorArticle[]>('kb-author-review', () => []);
  const hasDirectReports = useState<boolean>('kb-author-has-reports', () => false);
  const hydrated = useState<boolean>('kb-author-hydrated', () => false);

  const applyMine = (payload: MinePayload) => {
    own.value = Array.isArray(payload.own) ? payload.own : [];
    reports.value = Array.isArray(payload.reports) ? payload.reports : [];
    reviewQueue.value = Array.isArray(payload.reviewQueue) ? payload.reviewQueue : [];
    hasDirectReports.value = Boolean(payload.hasDirectReports);
  };

  const hydrate = async () => {
    const payload = await $fetch<MinePayload>('/api/knowledge/articles/mine');
    applyMine(payload);
    hydrated.value = true;
  };

  const createArticle = async (input: UpsertInput) => {
    const payload = await $fetch<{ article: KnowledgeAuthorArticle }>('/api/knowledge/articles', {
      method: 'POST',
      body: input
    });
    await hydrate();
    return payload.article;
  };

  const updateArticle = async (id: string, input: Omit<UpsertInput, 'asDraft'>) => {
    const payload = await $fetch<{ article: KnowledgeAuthorArticle }>(
      `/api/knowledge/articles/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: input }
    );
    await hydrate();
    return payload.article;
  };

  const submitArticle = async (id: string) => {
    const payload = await $fetch<{ article: KnowledgeAuthorArticle }>(
      `/api/knowledge/articles/${encodeURIComponent(id)}/submit`,
      { method: 'POST' }
    );
    await hydrate();
    return payload.article;
  };

  const moderateArticle = async (
    id: string,
    action: 'accept' | 'revision' | 'reject',
    reason?: string
  ) => {
    const payload = await $fetch<{ article: KnowledgeAuthorArticle }>(
      `/api/knowledge/articles/${encodeURIComponent(id)}/moderate`,
      { method: 'POST', body: { action, reason } }
    );
    await hydrate();
    return payload.article;
  };

  const addComment = async (id: string, quote: string, body: string) => {
    const payload = await $fetch<{ article: KnowledgeAuthorArticle }>(
      `/api/knowledge/articles/${encodeURIComponent(id)}/comments`,
      { method: 'POST', body: { quote, body } }
    );
    await hydrate();
    return payload.article;
  };

  const statusLabel = (status: KnowledgeAuthorStatus) => STATUS_LABELS[status] || status;

  const displayStatusLabel = (article: KnowledgeAuthorArticle) => {
    if (article.status === 'published' && article.pendingRevision) {
      return article.pendingRevision.status === 'pending_review'
        ? 'Правка на проверке'
        : 'Правка на доработку';
    }
    return statusLabel(article.status);
  };

  return {
    own,
    reports,
    reviewQueue,
    hasDirectReports,
    hydrated,
    hydrate,
    createArticle,
    updateArticle,
    submitArticle,
    moderateArticle,
    addComment,
    statusLabel,
    displayStatusLabel,
    articleNeedsReview,
    articleEditable,
    articleEditorFields
  };
}
