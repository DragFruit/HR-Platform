import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeJsonAtomic } from './atomicJson';
import { readKnowledgeArticles, type KnowledgeArticle } from './knowledgeArticlesStore';
import {
  distinctiveQueryTokens,
  expandQueryWithSynonyms,
  hasActsRegulationIntent,
  hasContactDirectoryIntent,
  hasUtmTaggingIntent,
  hasWriteoffAfinaIntent,
  hitCoversDistinctiveTokens,
  isActsSectionToken,
  isContactSectionToken,
  isUtmSectionToken,
  isWriteoffSectionToken,
  lexicalScore,
  longestRareToken,
  rareDistinctiveTokens,
  rareTokenHeadingHits,
  rareTokenStrength,
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
/** Смена нарезки/stripHtml — пересобрать индекс, даже если статьи те же. */
const INDEX_VERSION = 6;

/** Статья-справочник контактов (якоря секций). */
const CONTACTS_ARTICLE_ID = 'kb-20409';
/** Регламент UTM тегирования. */
const UTM_ARTICLE_ID = 'kb-23420';
/** Акты от рекламных площадок (YDirect / VKR / SMM). */
const ACTS_ARTICLE_ID = 'kb-31980';
/** Списания в AFINA (комиссии, прочее, доп.расходы). */
const WRITEOFF_ARTICLE_ID = 'kb-28468';

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

/**
 * HTML → plain с сохранением строк: иначе шапки секций «Контактов»
 * («Дизайнеры», «Юристы / …») схлопываются в одну длинную строку и
 * rareTokenHeadingHits всегда 0 → уезжаем в DayOfff / маркетплейсы.
 */
const stripHtml = (html: string) =>
  String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&\w+;/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
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

/**
 * Длинные статьи режем по блокам.
 * Underscore-разделители + шапки секций с начала строки (не mid-body «ads, programmatic»).
 */
const CONTACT_SECTION_LINE_START =
  /(?:^|\n)\s*(?=(?:Programmatic\b|Юридическая\s+поддержка|Бюро\s+переводов|Дизайнеры\b|Копирайтеры\b|Яндекс\s+Менеджер|Google\s*360|CLICK\s*RU|Наружная\s+реклама))/gi;

const UTM_SECTION_LINE_START =
  /(?:^|\n)\s*(?=(?:Топ ошибок|Коллтрекинги\s+и\s+авторазметка|UIS\/Comagic|Roistat\b|Calltou|Параметр\s+utm_))/gi;

const GUEST_ACCESS_SECTION_LINE_START = /(?:^|\n)\s*(?=Доступ к\s+)/gi;

const ACTS_SECTION_LINE_START =
  /(?:^|\n)\s*(?=(?:Акты\s+Яндекс|Акты\s+ВКР|YDirect\b|VKR\s+Таргет|ADD\s+COST\s+SMM|Прочие\s+списания\s+отдела\s+SMM))/gi;

const WRITEOFF_SECTION_LINE_START =
  /(?:^|\n)\s*(?=(?:1\.\s*По\s+какому\s+правилу|Прочее\s*\(PPC\)|Доп\.?\s*расходы\s*\(SMM\)|2\.\s*Обязательно\s+указывать\s+комментарий|4\.\s*Какие\s+правила|5\.\s*Есть\s+также\s+тип|6\.\s*Списание\s+рекламного\s+сбора))/gi;

const DAYOFF_SAAS_SECTION_LINE_START =
  /(?:^|\n)\s*(?=(?:Авторизация\s+в\s+DayOFFF|Раздел\s+системы\s+[«"“]?Проекты|Раздел\s+системы\s+[«"“]?Дополнительные\s+расходы|Раздел\s+системы\s+[«"“]?Дашборд|Раздел\s+системы\s+[«"“]?Статусы\s+проектов))/gi;

function splitPlainSections(plain: string): string[] {
  const marked = String(plain || '')
    .replace(/_{12,}/g, '\n§\n')
    .replace(CONTACT_SECTION_LINE_START, '\n§\n')
    .replace(UTM_SECTION_LINE_START, '\n§\n')
    .replace(GUEST_ACCESS_SECTION_LINE_START, '\n§\n')
    .replace(ACTS_SECTION_LINE_START, '\n§\n')
    .replace(WRITEOFF_SECTION_LINE_START, '\n§\n')
    .replace(DAYOFF_SAAS_SECTION_LINE_START, '\n§\n');
  const sections = marked
    .split(/\n§\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sections.length ? sections : [plain];
}

/** «Кому писать» или якорь секции Контактов → только kb-20409. */
function preferContactsDirectory(question: string, anchor: string | null): boolean {
  if (hasUtmTaggingIntent(question)) return false;
  if (hasActsRegulationIntent(question)) return false;
  if (hasWriteoffAfinaIntent(question)) return false;
  if (hasContactDirectoryIntent(question)) return true;
  return Boolean(anchor && isContactSectionToken(anchor));
}

/** UTM / коллтрекинг-метки → только kb-23420. */
function preferUtmRegulation(question: string, anchor: string | null): boolean {
  if (!hasUtmTaggingIntent(question)) return false;
  if (hasContactDirectoryIntent(question)) return false;
  return Boolean(anchor && isUtmSectionToken(anchor)) || hasUtmTaggingIntent(question);
}

/** Акты РП → только kb-31980. */
function preferActsRegulation(question: string, anchor: string | null): boolean {
  if (!hasActsRegulationIntent(question)) return false;
  if (hasUtmTaggingIntent(question) || hasContactDirectoryIntent(question)) return false;
  return Boolean(anchor && isActsSectionToken(anchor)) || hasActsRegulationIntent(question);
}

/** Списания AFINA → только kb-28468. */
function preferWriteoffAfina(question: string, anchor: string | null): boolean {
  if (!hasWriteoffAfinaIntent(question)) return false;
  if (hasActsRegulationIntent(question) && /акт/i.test(question) && !/списан/i.test(question)) {
    return false;
  }
  if (hasUtmTaggingIntent(question) || hasContactDirectoryIntent(question)) return false;
  return Boolean(anchor && isWriteoffSectionToken(anchor)) || hasWriteoffAfinaIntent(question);
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
  limit = 3,
  question = ''
): string[] {
  if (!chunkTexts.length) return [];
  const rare = rareDistinctiveTokens(distinctive);
  const whenCalltracking =
    /когда|обязательн|случа/i.test(question) &&
    /(uis|roistat|calltouch|comagic|коллтрек|колтрек)/i.test(question);
  const actsPlatform = /vkr|вкр|ydirect|яндекс|директ|smm|add\s*cost/i.test(question)
    ? question
    : '';
  const ranked = chunkTexts
    .map((text, idx) => {
      const lex = lexicalScore(title, text, queryTokens);
      const rareHits = rare.filter((t) => textCoversToken(`${title}\n${text}`, t)).length;
      const distHits = distinctive.filter((t) => textCoversToken(`${title}\n${text}`, t)).length;
      const anchor = longestRareToken(distinctive, question);
      const strength = anchor ? rareTokenStrength(`${title}\n${text}`, anchor) : 0;
      let score = strength * 4 + rareHits * 3 + distHits * 0.6 + lex;
      // иначе calltouch тянет шаблоны РК, а не «когда обязательно размечать коллтрекингом»
      if (
        whenCalltracking &&
        /существуют случаи|коллтрекинги и авторазметка|невозможно отключить авторазметку|импортировать расходы/i.test(
          text
        )
      ) {
        score += 25;
      }
      if (actsPlatform) {
        if (/vkr|вкр/i.test(actsPlatform) && /vkr\s*таргет|акты\s*вкр/i.test(text)) score += 20;
        if (
          /ydirect|яндекс|директ/i.test(actsPlatform) &&
          /ydirect|акты\s*яндекс/i.test(text) &&
          !/vkr\s*таргет/i.test(text.slice(0, 80))
        ) {
          score += 20;
        }
        if (/smm|add\s*cost/i.test(actsPlatform) && /add\s*cost\s*smm|акты\s*add/i.test(text)) {
          score += 20;
        }
      }
      if (
        /прочее\s*\(?\s*ppc|комисси.*доход|перевод\s+на\s+карту/i.test(question) &&
        /прочее\s*\(ppc\)|доп\.?\s*расходы\s*\(smm\)/i.test(text)
      ) {
        score += 15;
      }
      return { text, idx, score };
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

  const topChunks = opts?.topChunks ?? TOP_CHUNKS;
  const topArticles = opts?.topArticles ?? TOP_ARTICLES;
  const minSem = opts?.minScore ?? MIN_SEMANTIC;
  const publishedById = new Map(published.map((a) => [a.id, a]));
  const distinctive = distinctiveQueryTokens(q);
  const visibleChunks = index.chunks.filter((c) => visibleIds.has(c.articleId));
  const lexTokensFast = tokenizeForRag(expandQueryWithSynonyms(q));

  // Sense (дейоф / доступы) — до hard-якорей Контактов: иначе «dayofff» без ambiguous,
  // а clear «взять дейоф» без якоря уходит только в hybrid.
  {
    const clearEarly = clearSenseForQuestion(q);
    const ambEarly = ambiguousBranchesForQuestion(q);
    if (clearEarly) {
      const senseHit = pickSenseHit(
        [],
        clearEarly,
        publishedById,
        visibleChunks,
        new Map()
      );
      if (senseHit && visibleIds.has(senseHit.articleId)) {
        const articleChunks = visibleChunks
          .filter((c) => c.articleId === senseHit.articleId)
          .map((c) => c.text);
        senseHit.snippets = pickArticleSnippets(
          senseHit.title,
          articleChunks,
          distinctive,
          lexTokensFast,
          3,
          q
        );
        return { hits: [senseHit], ambiguous: false, branches: [] };
      }
    }
    if (ambEarly.length >= 2) {
      const branches: KnowledgeRagBranch[] = [];
      for (const sense of ambEarly) {
        const hit = pickSenseHit([], sense, publishedById, visibleChunks, new Map());
        if (!hit || !visibleIds.has(hit.articleId)) continue;
        const articleChunks = visibleChunks
          .filter((c) => c.articleId === hit.articleId)
          .map((c) => c.text);
        hit.snippets = pickArticleSnippets(
          hit.title,
          articleChunks,
          distinctive,
          lexTokensFast,
          3,
          q
        );
        branches.push({ label: sense.label, hit });
      }
      if (branches.length >= 2) {
        return {
          hits: branches.map((b) => b.hit),
          ambiguous: true,
          branches: branches.slice(0, 3)
        };
      }
    }
  }

  // Жёсткий якорь секций — ДО rewrite/эмбеддингов (иначе Yandex rewrite
  // без таймаута даёт 504, а mid-body в DayOfff/КЛАДОВКЕ уводит от справочника).
  const anchor = longestRareToken(distinctive, q);
  if (anchor) {
    const ranked = visibleChunks
      .map((chunk) => {
        const blob = `${chunk.title}\n${chunk.text}`;
        const strength = rareTokenStrength(blob, anchor);
        const headings = rareTokenHeadingHits(blob, anchor);
        const lex = lexicalScore(chunk.title, chunk.text, lexTokensFast);
        return { chunk, strength, headings, lex };
      })
      .filter((row) => row.strength > 0)
      .sort((a, b) => b.headings - a.headings || b.strength - a.strength || b.lex - a.lex);

    if (ranked.length) {
      const bestHeadings = ranked[0]!.headings;
      let preferred =
        bestHeadings > 0 ? ranked.filter((row) => row.headings > 0) : ranked;
      if (preferUtmRegulation(q, anchor)) {
        const utmOnly = ranked.filter(
          (row) =>
            row.strength > 0 &&
            (row.chunk.articleId === UTM_ARTICLE_ID || /utm/i.test(row.chunk.title))
        );
        if (utmOnly.length) {
          preferred = utmOnly;
        } else {
          // якорь calltouch/uis часто сильнее в «гостевых», но интент — регламент UTM
          const utmRows = visibleChunks
            .filter((c) => c.articleId === UTM_ARTICLE_ID)
            .map((chunk) => {
              const blob = `${chunk.title}\n${chunk.text}`;
              return {
                chunk,
                strength: Math.max(1, rareTokenStrength(blob, anchor)),
                headings: rareTokenHeadingHits(blob, anchor),
                lex: lexicalScore(chunk.title, chunk.text, lexTokensFast)
              };
            });
          if (utmRows.length) preferred = utmRows;
        }
      } else if (preferActsRegulation(q, anchor)) {
        const actsOnly = ranked.filter(
          (row) =>
            row.strength > 0 &&
            (row.chunk.articleId === ACTS_ARTICLE_ID || /акт/i.test(row.chunk.title))
        );
        if (actsOnly.length) {
          preferred = actsOnly;
        } else {
          const actsRows = visibleChunks
            .filter((c) => c.articleId === ACTS_ARTICLE_ID)
            .map((chunk) => {
              const blob = `${chunk.title}\n${chunk.text}`;
              return {
                chunk,
                strength: Math.max(1, rareTokenStrength(blob, anchor)),
                headings: rareTokenHeadingHits(blob, anchor),
                lex: lexicalScore(chunk.title, chunk.text, lexTokensFast)
              };
            });
          if (actsRows.length) preferred = actsRows;
        }
      } else if (preferWriteoffAfina(q, anchor)) {
        const woOnly = ranked.filter(
          (row) =>
            row.strength > 0 &&
            (row.chunk.articleId === WRITEOFF_ARTICLE_ID || /списан/i.test(row.chunk.title))
        );
        if (woOnly.length) {
          preferred = woOnly;
        } else {
          const woRows = visibleChunks
            .filter((c) => c.articleId === WRITEOFF_ARTICLE_ID)
            .map((chunk) => {
              const blob = `${chunk.title}\n${chunk.text}`;
              return {
                chunk,
                strength: Math.max(1, rareTokenStrength(blob, anchor)),
                headings: rareTokenHeadingHits(blob, anchor),
                lex: lexicalScore(chunk.title, chunk.text, lexTokensFast)
              };
            });
          if (woRows.length) preferred = woRows;
        }
      } else if (preferContactsDirectory(q, anchor)) {
        const contactsOnly = ranked.filter(
          (row) =>
            row.strength > 0 &&
            (row.chunk.articleId === CONTACTS_ARTICLE_ID ||
              /^контакты$/i.test(row.chunk.title.trim()))
        );
        if (contactsOnly.length) preferred = contactsOnly;
      }
      const byArticle = new Map<string, KnowledgeRagHit>();
      for (const row of preferred) {
        const existing = byArticle.get(row.chunk.articleId);
        const score = Math.min(1, 0.55 + row.strength * 0.08 + row.headings * 0.12 + row.lex * 0.2);
        if (!existing) {
          byArticle.set(row.chunk.articleId, {
            articleId: row.chunk.articleId,
            title: row.chunk.title,
            score,
            lexicalScore: row.lex,
            snippets: [row.chunk.text]
          });
        } else if (score > existing.score) {
          existing.score = score;
          existing.lexicalScore = row.lex;
        }
      }
      for (const hit of byArticle.values()) {
        const articleChunks = visibleChunks
          .filter((c) => c.articleId === hit.articleId)
          .map((c) => c.text);
        hit.snippets = pickArticleSnippets(hit.title, articleChunks, distinctive, lexTokensFast, 3, q);
      }
      let hits = [...byArticle.values()].sort((a, b) => {
        const ha = rareTokenHeadingHits(`${a.title}\n${a.snippets.join('\n')}`, anchor);
        const hb = rareTokenHeadingHits(`${b.title}\n${b.snippets.join('\n')}`, anchor);
        const sa = rareTokenStrength(`${a.title}\n${a.snippets.join('\n')}`, anchor);
        const sb = rareTokenStrength(`${b.title}\n${b.snippets.join('\n')}`, anchor);
        return hb - ha || sb - sa || b.score - a.score;
      });
      const maxHead = Math.max(
        0,
        ...hits.map((h) => rareTokenHeadingHits(`${h.title}\n${h.snippets.join('\n')}`, anchor))
      );
      if (maxHead > 0) {
        hits = hits.filter(
          (h) => rareTokenHeadingHits(`${h.title}\n${h.snippets.join('\n')}`, anchor) > 0
        );
      }
      if (preferUtmRegulation(q, anchor)) {
        const only = hits.filter(
          (h) => h.articleId === UTM_ARTICLE_ID || /utm/i.test(h.title)
        );
        if (only.length) hits = only;
      } else if (preferActsRegulation(q, anchor)) {
        const only = hits.filter(
          (h) => h.articleId === ACTS_ARTICLE_ID || /акт/i.test(h.title)
        );
        if (only.length) hits = only;
      } else if (preferWriteoffAfina(q, anchor)) {
        const only = hits.filter(
          (h) => h.articleId === WRITEOFF_ARTICLE_ID || /списан/i.test(h.title)
        );
        if (only.length) hits = only;
      } else if (preferContactsDirectory(q, anchor)) {
        const only = hits.filter(
          (h) => h.articleId === CONTACTS_ARTICLE_ID || /^контакты$/i.test(h.title.trim())
        );
        if (only.length) hits = only;
      }
      return {
        hits: hits.slice(0, topArticles),
        ambiguous: false,
        branches: []
      };
    }
  }

  const plan = await buildRetrievalQueryPlan(q);
  const lexTokens = tokenizeForRag(plan.lexicalQuery);

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
    hit.snippets = pickArticleSnippets(hit.title, articleChunks, distinctive, lexTokens, 3, q);
  }

  let hits = [...byArticle.values()].sort((a, b) => b.score - a.score);

  // Семантика тянет «клиент/CRM» на чужие статьи — оставляем только покрытие значимых слов.
  if (distinctive.length) {
    const covered = hits.filter((h) => hitCoversDistinctiveTokens(h.title, h.snippets, distinctive));
    hits = covered;
    const hybridAnchor = longestRareToken(distinctive, q);
    if (hybridAnchor && hits.length) {
      const strengths = hits.map((h) => ({
        h,
        s: rareTokenStrength(`${h.title}\n${h.snippets.join('\n')}`, hybridAnchor)
      }));
      const maxS = Math.max(0, ...strengths.map((x) => x.s));
      if (maxS >= 2) {
        hits = strengths.filter((x) => x.s >= 2).map((x) => x.h);
      }
    }
  }

  const clearSense = clearSenseForQuestion(q);
  let ambiguousBranches = ambiguousBranchesForQuestion(q);
  // если clear — только эта ветка (иначе «доступы директ» тянет чужие шаги из гостевых)
  if (clearSense) {
    ambiguousBranches = [];
    const hit = pickSenseHit(hits, clearSense, publishedById, visibleChunks, semByChunk);
    if (hit && visibleIds.has(hit.articleId)) {
      hits = [hit];
    }
  }

  // UTM / акты / списания на hybrid path (без сильного якоря в hard)
  if (!clearSense && preferUtmRegulation(q, longestRareToken(distinctive, q))) {
    const utmHit = hits.find((h) => h.articleId === UTM_ARTICLE_ID);
    if (utmHit) {
      hits = [utmHit];
    } else {
      const article = publishedById.get(UTM_ARTICLE_ID);
      if (article && visibleIds.has(UTM_ARTICLE_ID)) {
        const articleChunks = visibleChunks.filter((c) => c.articleId === UTM_ARTICLE_ID);
        hits = [
          {
            articleId: UTM_ARTICLE_ID,
            title: article.title,
            score: 0.7,
            snippets: pickArticleSnippets(
              article.title,
              articleChunks.map((c) => c.text),
              distinctive,
              lexTokens,
              3,
              q
            )
          }
        ];
      }
    }
  } else if (!clearSense && preferActsRegulation(q, longestRareToken(distinctive, q))) {
    const actsHit = hits.find((h) => h.articleId === ACTS_ARTICLE_ID);
    if (actsHit) {
      hits = [actsHit];
    } else {
      const article = publishedById.get(ACTS_ARTICLE_ID);
      if (article && visibleIds.has(ACTS_ARTICLE_ID)) {
        const articleChunks = visibleChunks.filter((c) => c.articleId === ACTS_ARTICLE_ID);
        hits = [
          {
            articleId: ACTS_ARTICLE_ID,
            title: article.title,
            score: 0.7,
            snippets: pickArticleSnippets(
              article.title,
              articleChunks.map((c) => c.text),
              distinctive,
              lexTokens,
              3,
              q
            )
          }
        ];
      }
    }
  } else if (!clearSense && preferWriteoffAfina(q, longestRareToken(distinctive, q))) {
    const woHit = hits.find((h) => h.articleId === WRITEOFF_ARTICLE_ID);
    if (woHit) {
      hits = [woHit];
    } else {
      const article = publishedById.get(WRITEOFF_ARTICLE_ID);
      if (article && visibleIds.has(WRITEOFF_ARTICLE_ID)) {
        const articleChunks = visibleChunks.filter((c) => c.articleId === WRITEOFF_ARTICLE_ID);
        hits = [
          {
            articleId: WRITEOFF_ARTICLE_ID,
            title: article.title,
            score: 0.7,
            snippets: pickArticleSnippets(
              article.title,
              articleChunks.map((c) => c.text),
              distinctive,
              lexTokens,
              3,
              q
            )
          }
        ];
      }
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

