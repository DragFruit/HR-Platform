import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeJsonAtomic } from './atomicJson';
import { resolveArticleDepartments } from './knowledgeAudience';
import { normalizeKnowledgeArticleBody } from './knowledgeArticleHtml';

/** Workflow statuses. Legacy `review` normalizes to `pending_review`. */
export type KnowledgeArticleStatus =
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
  /** Review state of the pending revision (published article stays live). */
  status: 'pending_review' | 'revision_requested';
};

export const normalizeKnowledgeArticleStatus = (value: unknown): KnowledgeArticleStatus => {
  const raw = String(value || '').trim();
  if (raw === 'published') return 'published';
  if (raw === 'draft') return 'draft';
  if (raw === 'revision_requested') return 'revision_requested';
  if (raw === 'rejected') return 'rejected';
  // legacy admin `review` → pending_review
  if (raw === 'pending_review' || raw === 'review') return 'pending_review';
  return 'draft';
};

export type KnowledgeArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  breadcrumbs: string[];
  /**
   * Кому видна: [] = всей компании; иначе только эти отделы (как в employees.department).
   */
  departments: string[];
  status: KnowledgeArticleStatus;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  /** Session / platform user id автора (сотрудник). */
  authorUserId: number | null;
  comments: KnowledgeInlineComment[];
  /** Правка опубликованной статьи: старый текст живёт, пока менеджер не примет. */
  pendingRevision: KnowledgePendingRevision | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  closedAt: string | null;
};

export type KnowledgeArticlesState = {
  articles: KnowledgeArticle[];
  nextId: number;
};

const DATA_FILE = join(process.cwd(), 'server/data/knowledge-articles.json');

export const defaultKnowledgeArticlesState = (): KnowledgeArticlesState => ({
  articles: [],
  nextId: 1
});

const toIso = () => new Date().toISOString();

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 20);
};

const normalizeComments = (value: unknown): KnowledgeInlineComment[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const row = raw as Partial<KnowledgeInlineComment>;
      const id = String(row.id || '').trim();
      const quote = String(row.quote || '').trim();
      const body = String(row.body || '').trim();
      const authorName = String(row.authorName || '').trim() || 'Руководитель';
      const authorUserId = Number(row.authorUserId);
      const createdAt = String(row.createdAt || '').trim() || toIso();
      if (!id || !body || !Number.isFinite(authorUserId) || authorUserId <= 0) return null;
      return { id, quote, body, authorName, authorUserId, createdAt };
    })
    .filter((item): item is KnowledgeInlineComment => Boolean(item));
};

const normalizePendingRevision = (value: unknown): KnowledgePendingRevision | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<KnowledgePendingRevision> & { departments?: unknown };
  const title = String(raw.title || '').trim();
  const body = normalizeKnowledgeArticleBody(String(raw.body || '').trim());
  if (!title || !body) return null;
  const revStatus =
    raw.status === 'revision_requested' ? 'revision_requested' : 'pending_review';
  return {
    title,
    summary: String(raw.summary || '').trim(),
    body,
    tags: normalizeTags(raw.tags),
    departments: resolveArticleDepartments({
      departments: raw.departments,
      title,
      breadcrumbs: []
    }),
    submittedAt: String(raw.submittedAt || '').trim() || toIso(),
    status: revStatus
  };
};

const normalizeArticle = (raw: Partial<KnowledgeArticle>): KnowledgeArticle | null => {
  const id = String(raw.id || '').trim();
  if (!id) return null;

  const title = String(raw.title || '').trim();
  const summary = String(raw.summary || '').trim();
  const body = normalizeKnowledgeArticleBody(String(raw.body || '').trim());
  const authorName = String(raw.authorName || '').trim() || 'Администратор';
  const createdAt = String(raw.createdAt || '').trim() || toIso();
  const updatedAt = String(raw.updatedAt || '').trim() || createdAt;
  const breadcrumbs = normalizeTags((raw as Record<string, unknown>).breadcrumbs);
  const tags = normalizeTags(raw.tags);
  const authorUserIdRaw = Number((raw as { authorUserId?: unknown }).authorUserId);
  const authorUserId =
    Number.isFinite(authorUserIdRaw) && authorUserIdRaw > 0 ? authorUserIdRaw : null;

  if (!title) return null;

  return {
    id,
    title,
    summary,
    body,
    tags,
    breadcrumbs,
    departments: resolveArticleDepartments({
      departments: (raw as { departments?: unknown }).departments,
      title,
      breadcrumbs
    }),
    status: normalizeKnowledgeArticleStatus(raw.status),
    createdAt,
    updatedAt,
    authorName,
    authorUserId,
    comments: normalizeComments((raw as { comments?: unknown }).comments),
    pendingRevision: normalizePendingRevision((raw as { pendingRevision?: unknown }).pendingRevision),
    approvedAt: String((raw as { approvedAt?: unknown }).approvedAt || '').trim() || null,
    rejectionReason: String((raw as { rejectionReason?: unknown }).rejectionReason || '').trim() || null,
    submittedAt: String((raw as { submittedAt?: unknown }).submittedAt || '').trim() || null,
    closedAt: String((raw as { closedAt?: unknown }).closedAt || '').trim() || null
  };
};

export function normalizeKnowledgeArticlesState(raw: Partial<KnowledgeArticlesState>): KnowledgeArticlesState {
  const articles = Array.isArray(raw.articles)
    ? raw.articles
        .map((item) => normalizeArticle(item as Partial<KnowledgeArticle>))
        .filter((item): item is KnowledgeArticle => Boolean(item))
    : [];
  return {
    articles,
    nextId: typeof raw.nextId === 'number' && raw.nextId > 0 ? raw.nextId : 1
  };
}

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeJsonAtomic(DATA_FILE, defaultKnowledgeArticlesState());
  }
}

export async function readKnowledgeArticles(): Promise<KnowledgeArticlesState> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  return normalizeKnowledgeArticlesState(JSON.parse(raw) as Partial<KnowledgeArticlesState>);
}

export async function writeKnowledgeArticles(state: KnowledgeArticlesState): Promise<KnowledgeArticlesState> {
  await ensureFile();
  const normalized = normalizeKnowledgeArticlesState(state);
  await writeJsonAtomic(DATA_FILE, normalized);
  return normalized;
}

let mutationQueue: Promise<unknown> = Promise.resolve();

export async function mutateKnowledgeArticles(
  mutator: (state: KnowledgeArticlesState) => KnowledgeArticlesState | Promise<KnowledgeArticlesState>
): Promise<KnowledgeArticlesState> {
  const run = mutationQueue.then(async () => {
    const current = await readKnowledgeArticles();
    const next = await mutator(current);
    return writeKnowledgeArticles(next);
  });
  mutationQueue = run.catch(() => {});
  return run;
}

/** Статья ждёт проверки руководителя (новая или правка опубликованной). */
export function articleNeedsManagerReview(article: KnowledgeArticle): boolean {
  if (article.status === 'pending_review') return true;
  if (article.status === 'published' && article.pendingRevision?.status === 'pending_review') {
    return true;
  }
  return false;
}

/** Автор может править основной текст / pending revision. */
export function articleEditableByAuthor(article: KnowledgeArticle): boolean {
  if (article.status === 'rejected') return false;
  if (article.status === 'pending_review') return false;
  if (article.status === 'published') {
    if (!article.pendingRevision) return true;
    return article.pendingRevision.status === 'revision_requested';
  }
  return article.status === 'draft' || article.status === 'revision_requested';
}

export const KNOWLEDGE_STATUS_LABELS: Record<KnowledgeArticleStatus, string> = {
  draft: 'Черновик',
  pending_review: 'На проверке',
  published: 'Опубликовано',
  revision_requested: 'На доработку',
  rejected: 'Отклонено'
};
