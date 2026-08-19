import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeJsonAtomic } from './atomicJson';

export type KnowledgeArticleStatus = 'review' | 'published';

export const normalizeKnowledgeArticleStatus = (value: unknown): KnowledgeArticleStatus =>
  value === 'published' ? 'published' : 'review';

export type KnowledgeArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  breadcrumbs: string[];
  status: KnowledgeArticleStatus;
  createdAt: string;
  updatedAt: string;
  authorName: string;
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

const normalizeStatus = normalizeKnowledgeArticleStatus;

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 20);
};

const normalizeArticle = (raw: Partial<KnowledgeArticle>): KnowledgeArticle | null => {
  const id = String(raw.id || '').trim();
  if (!id) return null;

  const title = String(raw.title || '').trim();
  const summary = String(raw.summary || '').trim();
  const body = String(raw.body || '').trim();
  const authorName = String(raw.authorName || '').trim() || 'Администратор';
  const createdAt = String(raw.createdAt || '').trim() || toIso();
  const updatedAt = String(raw.updatedAt || '').trim() || createdAt;

  if (!title) return null;

  return {
    id,
    title,
    summary,
    body,
    tags: normalizeTags(raw.tags),
    breadcrumbs: normalizeTags((raw as Record<string, unknown>).breadcrumbs),
    status: normalizeStatus(raw.status),
    createdAt,
    updatedAt,
    authorName
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
