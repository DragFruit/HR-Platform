import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeJsonAtomic } from './atomicJson';
import { readKnowledgeArticles, type KnowledgeArticle } from './knowledgeArticlesStore';
import { lexicalScore, tokenizeForRag } from './knowledgeRagLexical';
import { buildRetrievalQueryPlan } from './knowledgeRagRewrite';
import { cosineSimilarity, yandexEmbedText } from './yandexEmbeddings';

const INDEX_FILE = join(process.cwd(), 'server/data/knowledge-rag-index.json');

/** Макс. длина фрагмента (символы). */
const CHUNK_SIZE = 1200;
/** Перекрытие между соседними фрагментами. */
const CHUNK_OVERLAP = 150;
/** Сколько фрагментов отдаём в ранжирование. */
const TOP_CHUNKS = 8;
/** Сколько разных статей в контекст модели. */
const TOP_ARTICLES = 3;
/** Минимальная близость смысла (cosine). */
const MIN_SEMANTIC = 0.35;
/** Минимальный комбинированный score (смысл + слова). */
const MIN_COMBINED = 0.32;
/** Сильный словесный hit — берём даже при слабом смысле (точное название/термин). */
const MIN_LEXICAL_RESCUE = 0.55;
/** Веса гибрида. */
const W_SEM = 0.7;
const W_LEX = 0.3;

export type KnowledgeRagChunk = {
  id: string;
  articleId: string;
  title: string;
  text: string;
  contentHash: string;
  embedding: number[];
};

export type KnowledgeRagIndex = {
  version: 1;
  updatedAt: string;
  /** Хеш набора опубликованных статей (id+updatedAt+body) — чтобы понять, устарел ли индекс. */
  corpusHash: string;
  chunks: KnowledgeRagChunk[];
};

const stripHtml = (html: string) =>
  String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hashText = (value: string) => createHash('sha1').update(value).digest('hex').slice(0, 16);

export function chunkArticleText(title: string, bodyHtml: string): string[] {
  const plain = stripHtml(bodyHtml);
  const full = `${title}\n\n${plain}`.trim();
  if (!full) return [];

  if (full.length <= CHUNK_SIZE) return [full];

  const chunks: string[] = [];
  let start = 0;
  while (start < full.length) {
    let end = Math.min(start + CHUNK_SIZE, full.length);
    if (end < full.length) {
      const slice = full.slice(start, end);
      const breakAt = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '));
      if (breakAt > CHUNK_SIZE * 0.5) end = start + breakAt + 1;
    }
    const piece = full.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= full.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }
  return chunks;
}

function corpusHashFromArticles(articles: KnowledgeArticle[]): string {
  const rows = articles
    .filter((a) => a.status === 'published')
    .map((a) => `${a.id}|${a.updatedAt}|${hashText(a.title + '\n' + a.body)}`)
    .sort();
  return hashText(rows.join('\n'));
}

async function readIndexFile(): Promise<KnowledgeRagIndex | null> {
  try {
    const raw = await readFile(INDEX_FILE, 'utf8');
    const parsed = JSON.parse(raw) as KnowledgeRagIndex;
    if (parsed?.version !== 1 || !Array.isArray(parsed.chunks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeIndexFile(index: KnowledgeRagIndex): Promise<void> {
  await mkdir(dirname(INDEX_FILE), { recursive: true });
  await writeJsonAtomic(INDEX_FILE, index);
}

let rebuildQueue: Promise<KnowledgeRagIndex | null> = Promise.resolve(null);

/** Полная пересборка индекса по опубликованным статьям. */
export async function rebuildKnowledgeRagIndex(opts?: {
  force?: boolean;
  onProgress?: (done: number, total: number) => void;
}): Promise<KnowledgeRagIndex> {
  const run = rebuildQueue.then(async () => {
    const state = await readKnowledgeArticles();
    const published = state.articles.filter((a) => a.status === 'published');
    const nextHash = corpusHashFromArticles(published);

    if (!opts?.force) {
      const existing = await readIndexFile();
      if (existing && existing.corpusHash === nextHash && existing.chunks.length) {
        return existing;
      }
    }

    const byContent = new Map<string, KnowledgeRagChunk>();
    const prev = (await readIndexFile())?.chunks ?? [];
    for (const chunk of prev) {
      byContent.set(`${chunk.articleId}:${chunk.contentHash}`, chunk);
    }

    const nextChunks: KnowledgeRagChunk[] = [];
    let done = 0;
    const planned: { article: KnowledgeArticle; texts: string[] }[] = published.map((article) => ({
      article,
      texts: chunkArticleText(article.title, article.body)
    }));
    const totalEmbeds = planned.reduce((sum, row) => sum + row.texts.length, 0);

    for (const { article, texts } of planned) {
      for (let i = 0; i < texts.length; i += 1) {
        const text = texts[i]!;
        const contentHash = hashText(text);
        const cacheKey = `${article.id}:${contentHash}`;
        const cached = byContent.get(cacheKey);
        let embedding = cached?.embedding;
        if (!embedding?.length) {
          embedding = await yandexEmbedText(text, 'doc');
          // небольшая пауза, чтобы не упираться в квоту
          await new Promise((r) => setTimeout(r, 40));
        }
        nextChunks.push({
          id: `${article.id}#${i}`,
          articleId: article.id,
          title: article.title,
          text,
          contentHash,
          embedding
        });
        done += 1;
        opts?.onProgress?.(done, totalEmbeds);
      }
    }

    const index: KnowledgeRagIndex = {
      version: 1,
      updatedAt: new Date().toISOString(),
      corpusHash: nextHash,
      chunks: nextChunks
    };
    await writeIndexFile(index);
    return index;
  });

  rebuildQueue = run.catch(() => null);
  return run;
}

/** Фоновая пересборка после правок статей (ошибки только в лог). */
export function scheduleKnowledgeRagRebuild(): void {
  void rebuildKnowledgeRagIndex().catch((err) => {
    console.warn('[knowledge-rag] rebuild failed', err);
  });
}

export type KnowledgeRagHit = {
  articleId: string;
  title: string;
  score: number;
  snippets: string[];
  semanticScore?: number;
  lexicalScore?: number;
};

/**
 * Подбор статей: смысл + слова, с осторожной переформулировкой запроса.
 * При устаревшем/пустом индексе — пытается пересобрать.
 */
export async function retrieveKnowledgeByMeaning(
  question: string,
  opts?: { topArticles?: number; topChunks?: number; minScore?: number }
): Promise<KnowledgeRagHit[]> {
  const q = question.trim();
  if (!q) return [];

  let index = await readIndexFile();
  const state = await readKnowledgeArticles();
  const expectedHash = corpusHashFromArticles(state.articles.filter((a) => a.status === 'published'));

  if (!index?.chunks?.length || index.corpusHash !== expectedHash) {
    index = await rebuildKnowledgeRagIndex();
  }
  if (!index.chunks.length) return [];

  const plan = await buildRetrievalQueryPlan(q);
  const topChunks = opts?.topChunks ?? TOP_CHUNKS;
  const topArticles = opts?.topArticles ?? TOP_ARTICLES;
  const minSem = opts?.minScore ?? MIN_SEMANTIC;
  const lexTokens = tokenizeForRag(plan.lexicalQuery);

  /** Лучший cosine по всем вариантам запроса. */
  const semByChunk = new Map<string, number>();
  for (const queryText of plan.queries) {
    const queryVector = await yandexEmbedText(queryText, 'query');
    for (const chunk of index.chunks) {
      const s = cosineSimilarity(queryVector, chunk.embedding);
      const prev = semByChunk.get(chunk.id) ?? 0;
      if (s > prev) semByChunk.set(chunk.id, s);
    }
  }

  const scored = index.chunks
    .map((chunk) => {
      const sem = semByChunk.get(chunk.id) ?? 0;
      const lex = lexicalScore(chunk.title, chunk.text, lexTokens);
      const combined = W_SEM * sem + W_LEX * lex;
      return { chunk, sem, lex, combined };
    })
    .filter((row) => row.sem >= minSem || row.lex >= MIN_LEXICAL_RESCUE || row.combined >= MIN_COMBINED)
    .sort((a, b) => b.combined - a.combined || b.sem - a.sem)
    .slice(0, topChunks);

  const byArticle = new Map<string, KnowledgeRagHit>();
  for (const row of scored) {
    const existing = byArticle.get(row.chunk.articleId);
    if (!existing) {
      byArticle.set(row.chunk.articleId, {
        articleId: row.chunk.articleId,
        title: row.chunk.title,
        score: row.combined,
        semanticScore: row.sem,
        lexicalScore: row.lex,
        snippets: [row.chunk.text]
      });
    } else {
      if (row.combined > existing.score) {
        existing.score = row.combined;
        existing.semanticScore = row.sem;
        existing.lexicalScore = row.lex;
      }
      if (existing.snippets.length < 3) existing.snippets.push(row.chunk.text);
    }
  }

  return [...byArticle.values()].sort((a, b) => b.score - a.score).slice(0, topArticles);
}

export function buildRagContext(hits: KnowledgeRagHit[]): string {
  const parts = hits.map((hit, idx) => {
    const body = hit.snippets.join('\n…\n');
    const limited = body.length > 4000 ? `${body.slice(0, 4000)}\n\n[обрезано]` : body;
    return `[${idx + 1}] ${hit.title}\n${limited}`;
  });
  const joined = parts.join('\n\n');
  return joined.length > 12000 ? `${joined.slice(0, 12000)}\n\n[обрезано]` : joined;
}
