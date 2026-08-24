import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeJsonAtomic } from './atomicJson';
import { readKnowledgeArticles, type KnowledgeArticle } from './knowledgeArticlesStore';
import {
  distinctiveQueryTokens,
  expandQueryWithSynonyms,
  hitCoversDistinctiveTokens,
  lexicalScore,
  rareDistinctiveTokens,
  textCoversToken,
  tokenizeForRag
} from './knowledgeRagLexical';
import { buildRetrievalQueryPlan } from './knowledgeRagRewrite';
import {
  ambiguousBranchesForQuestion,
  applySenseScoreAdjust,
  clearSenseForQuestion,
  type KnowledgeSense
} from './knowledgeRagSense';
import { canUserSeeArticle } from './knowledgeAudience';
import { cosineSimilarity, yandexEmbedText } from './yandexEmbeddings';

const INDEX_FILE = join(process.cwd(), 'server/data/knowledge-rag-index.json');
/** Смена нарезки — пересобрать индекс, даже если статьи те же. */
const INDEX_VERSION = 2;

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
  version: 2;
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

function windowChunks(text: string): string[] {
  const full = text.trim();
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

/** Длинные статьи (Контакты) режем по блокам, иначе Programmatic тонет в юристах/Яндексе. */
function splitPlainSections(plain: string): string[] {
  const marked = String(plain || '')
    .replace(/_{12,}/g, '\n§\n')
    .replace(/(?=\bProgrammatic\b)/gi, '\n§\n');
  const sections = marked
    .split(/\n§\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sections.length ? sections : [plain];
}

export function chunkArticleText(title: string, bodyHtml: string): string[] {
  const plain = stripHtml(bodyHtml);
  if (!plain) return [];
  const heading = title.trim();
  const sections = splitPlainSections(plain);
  const chunks: string[] = [];
  for (const section of sections) {
    const labeled = heading && !section.startsWith(heading) ? `${heading}\n\n${section}` : section;
    chunks.push(...windowChunks(labeled));
  }
  return chunks;
}

/** Из всех фрагментов статьи берём те, где есть якорь запроса, а не «случайный» верх. */
export function pickArticleSnippets(
  title: string,
  chunkTexts: string[],
  distinctive: string[],
  queryTokens: string[],
  limit = 3
): string[] {
  if (!chunkTexts.length) return [];
  const rare = rareDistinctiveTokens(distinctive);
  const ranked = chunkTexts
    .map((text, idx) => {
      const lex = lexicalScore(title, text, queryTokens);
      const rareHits = rare.filter((t) => textCoversToken(`${title}\n${text}`, t)).length;
      const distHits = distinctive.filter((t) => textCoversToken(`${title}\n${text}`, t)).length;
      return { text, idx, score: rareHits * 3 + distHits * 0.6 + lex };
    })
    .sort((a, b) => b.score - a.score || a.idx - b.idx);
  const picked: string[] = [];
  for (const row of ranked) {
    if (picked.length >= limit) break;
    if (picked.includes(row.text)) continue;
    picked.push(row.text);
  }
  return picked;
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
    if (parsed?.version !== INDEX_VERSION || !Array.isArray(parsed.chunks)) return null;
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
      if (
        existing &&
        existing.version === INDEX_VERSION &&
        existing.corpusHash === nextHash &&
        existing.chunks.length
      ) {
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
      version: INDEX_VERSION,
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

export type KnowledgeRagBranch = {
  label: string;
  hit: KnowledgeRagHit;
};

export type KnowledgeRagRetrieveResult = {
  hits: KnowledgeRagHit[];
  /** Два равноправных смысла — показать два ответа. */
  ambiguous: boolean;
  branches: KnowledgeRagBranch[];
};

/**
 * Подбор статей: смысл + слова, с разбором двусмысленностей (дейоф = отгул | SaaS).
 */
export async function retrieveKnowledgeByMeaning(
  question: string,
  opts?: { topArticles?: number; topChunks?: number; minScore?: number }
): Promise<KnowledgeRagHit[]> {
  const result = await retrieveKnowledgeDetailed(question, opts);
  return result.hits;
}

/** Полный результат с флагом двусмысленности. */
export async function retrieveKnowledgeDetailed(
  question: string,
  opts?: {
    topArticles?: number;
    topChunks?: number;
    minScore?: number;
    /** Фильтр по отделу сотрудника. */
    viewer?: { role: string; department: string };
  }
): Promise<KnowledgeRagRetrieveResult> {
  const q = question.trim();
  if (!q) return { hits: [], ambiguous: false, branches: [] };

  let index = await readIndexFile();
  const state = await readKnowledgeArticles();
  const expectedHash = corpusHashFromArticles(state.articles.filter((a) => a.status === 'published'));

  if (!index?.chunks?.length || index.corpusHash !== expectedHash) {
    index = await rebuildKnowledgeRagIndex();
  }
  if (!index.chunks.length) return { hits: [], ambiguous: false, branches: [] };

  const published = state.articles.filter((a) => a.status === 'published');
  const visibleIds = new Set(
    opts?.viewer
      ? published.filter((a) => canUserSeeArticle(a.departments, opts.viewer!)).map((a) => a.id)
      : published.map((a) => a.id)
  );

  const plan = await buildRetrievalQueryPlan(q);
  const topChunks = opts?.topChunks ?? TOP_CHUNKS;
  const topArticles = opts?.topArticles ?? TOP_ARTICLES;
  const minSem = opts?.minScore ?? MIN_SEMANTIC;
  const lexTokens = tokenizeForRag(plan.lexicalQuery);
  const publishedById = new Map(published.map((a) => [a.id, a]));
  const distinctive = distinctiveQueryTokens(q);

  const visibleChunks = index.chunks.filter((c) => visibleIds.has(c.articleId));

  const semByChunk = new Map<string, number>();
  for (const queryText of plan.queries) {
    const queryVector = await yandexEmbedText(queryText, 'query');
    for (const chunk of visibleChunks) {
      const s = cosineSimilarity(queryVector, chunk.embedding);
      const prev = semByChunk.get(chunk.id) ?? 0;
      if (s > prev) semByChunk.set(chunk.id, s);
    }
  }

  const scored = visibleChunks
    .map((chunk) => {
      const sem = semByChunk.get(chunk.id) ?? 0;
      const lex = lexicalScore(chunk.title, chunk.text, lexTokens);
      let combined = W_SEM * sem + W_LEX * lex;
      combined = applySenseScoreAdjust(chunk.articleId, combined, q);
      // Значимые слова (напр. «рождения») — поднимаем в top-K, иначе семантика «клиент» их вытесняет
      if (
        distinctive.length &&
        hitCoversDistinctiveTokens(chunk.title, [chunk.text], distinctive)
      ) {
        combined = Math.min(1, combined + 0.4);
      }
      return { chunk, sem, lex, combined };
    })
    .filter((row) => row.sem >= minSem || row.lex >= MIN_LEXICAL_RESCUE || row.combined >= MIN_COMBINED)
    .sort((a, b) => b.combined - a.combined || b.sem - a.sem)
    .slice(0, Math.max(topChunks, 12));

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

  for (const hit of byArticle.values()) {
    const articleChunks = visibleChunks.filter((c) => c.articleId === hit.articleId).map((c) => c.text);
    hit.snippets = pickArticleSnippets(hit.title, articleChunks, distinctive, lexTokens, 3);
  }

  let hits = [...byArticle.values()].sort((a, b) => b.score - a.score);

  // Семантика тянет «клиент/CRM» на чужие статьи — оставляем только покрытие значимых слов.
  if (distinctive.length) {
    const covered = hits.filter((h) => hitCoversDistinctiveTokens(h.title, h.snippets, distinctive));
    hits = covered;
  }

  const clearSense = clearSenseForQuestion(q);
  let ambiguousBranches = ambiguousBranchesForQuestion(q);
  // если clear — только эта ветка в приоритете
  if (clearSense) {
    ambiguousBranches = [];
    const hit = pickSenseHit(hits, clearSense, publishedById, visibleChunks, semByChunk);
    if (hit && visibleIds.has(hit.articleId)) {
      hits = [hit, ...hits.filter((h) => h.articleId !== hit.articleId)];
    }
  }

  let ambiguous = ambiguousBranches.length >= 2;
  const branches: KnowledgeRagBranch[] = [];

  if (ambiguous) {
    for (const sense of ambiguousBranches) {
      const hit = pickSenseHit(hits, sense, publishedById, visibleChunks, semByChunk);
      if (hit && visibleIds.has(hit.articleId)) {
        branches.push({ label: sense.label, hit });
      }
    }
    if (branches.length >= 2) {
      hits = branches.map((b) => b.hit);
    } else {
      ambiguous = false;
    }
  }

  return {
    hits: hits.slice(0, ambiguous ? Math.max(2, topArticles) : topArticles),
    ambiguous,
    branches: ambiguous ? branches.slice(0, 3) : []
  };
}

function pickSenseHit(
  hits: KnowledgeRagHit[],
  sense: KnowledgeSense,
  publishedById: Map<string, KnowledgeArticle>,
  chunks: KnowledgeRagChunk[],
  semByChunk: Map<string, number>
): KnowledgeRagHit | null {
  for (const id of sense.articleIds) {
    const existing = hits.find((h) => h.articleId === id);
    if (existing) return existing;
    const article = publishedById.get(id);
    if (!article) continue;
    const articleChunks = chunks.filter((c) => c.articleId === id);
    const best = articleChunks
      .map((c) => ({ c, s: semByChunk.get(c.id) ?? 0 }))
      .sort((x, y) => y.s - x.s)[0];
    return {
      articleId: id,
      title: article.title,
      score: best?.s ?? 0.4,
      semanticScore: best?.s,
      snippets: best ? [best.c.text] : [article.title]
    };
  }
  return null;
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

/** Контекст для двух смыслов: модель должна ответить двумя вариантами. */
export function buildRagAmbiguousContext(branches: KnowledgeRagBranch[]): string {
  const parts = branches.map((branch, idx) => {
    const body = branch.hit.snippets.join('\n…\n');
    const limited = body.length > 3500 ? `${body.slice(0, 3500)}\n\n[обрезано]` : body;
    return `Вариант ${idx + 1} — если вопрос про ${branch.label} (статья «${branch.hit.title}»):\n${limited}`;
  });
  return parts.join('\n\n');
}

/** Запасной подбор без эмбеддингов (если Yandex embeddings недоступны). */
export async function retrieveKnowledgeLexicalFallback(
  question: string,
  opts?: { topArticles?: number; viewer?: { role: string; department: string } }
): Promise<KnowledgeRagHit[]> {
  const q = question.trim();
  if (!q) return [];
  const tokens = tokenizeForRag(expandQueryWithSynonyms(q));
  if (!tokens.length) return [];
  const distinctive = distinctiveQueryTokens(q);

  const state = await readKnowledgeArticles();
  const published = state.articles.filter((a) => a.status === 'published');
  const visible = opts?.viewer
    ? published.filter((a) => canUserSeeArticle(a.departments, opts.viewer!))
    : published;

  let scored = visible
    .map((article) => {
      const chunkTexts = chunkArticleText(article.title, article.body);
      const plain = chunkTexts.join('\n');
      const lex = lexicalScore(article.title, plain, tokens);
      return {
        articleId: article.id,
        title: article.title,
        score: lex,
        lexicalScore: lex,
        snippets: pickArticleSnippets(article.title, chunkTexts, distinctive, tokens, 3)
      } satisfies KnowledgeRagHit;
    })
    .filter((h) => h.score >= 0.25)
    .sort((a, b) => b.score - a.score);

  if (distinctive.length) {
    scored = scored.filter((h) => hitCoversDistinctiveTokens(h.title, h.snippets, distinctive));
  }

  return scored.slice(0, opts?.topArticles ?? TOP_ARTICLES);
}

