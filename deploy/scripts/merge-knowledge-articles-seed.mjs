#!/usr/bin/env node
/**
 * Merge knowledge-articles.json on deploy:
 * - If target already has an article with the same `id` — keep target metadata
 *   (do not wipe admin edits), but refresh `body` / `coverImage` from seed when
 *   the seed carries local `/knowledge/...` assets or the target still has
 *   Bitrix page chrome (`/devs/asset/...` link/script), or
 *   the target body looks like escaped HTML (`&lt;a` / `&lt;br`) from an older
 *   editor path that treated inline HTML as markdown.
 * - Platform-owned Vibe help articles (`PLATFORM_OWNED_ARTICLE_IDS`) always
 *   take title/summary/body/tags/breadcrumbs/departments/status from seed.
 * - Retired seed ids (`RETIRED_ARTICLE_IDS`) are dropped from the target.
 * - Otherwise — add incoming article from seed.
 *
 * Usage:
 *   node merge-knowledge-articles-seed.mjs <target.json> <incoming.json>
 */
import { readFile, writeFile } from 'node:fs/promises';

/** Снятые сид-статьи: не оставлять на стенде после замены. */
const RETIRED_ARTICLE_IDS = new Set(['kb-vibe-vacations']);

/** Платформенные статьи Vibe / кейсы ecom: текст и аудитория всегда из сида. */
const PLATFORM_OWNED_ARTICLE_IDS = new Set([
  'kb-vibe-vacations-digital',
  'kb-vibe-vacations-other',
  'kb-vibe-ideas',
  'kb-case-ecom-index',
  'kb-case-ecom-cdek-shopping',
  'kb-case-ecom-kolesoru',
  'kb-case-ecom-ledeme',
  'kb-case-ecom-ecco',
  'kb-case-ecom-artkvartal',
  'kb-case-ecom-shop-sanequip',
  'kb-case-ecom-lifestyle-unico',
  'kb-case-ecom-garda-opt',
  'kb-case-ecom-portaprima',
  'kb-case-ecom-mk-shatura',
  'kb-case-ecom-age-of-innocence'
]);

const [targetPath, incomingPath] = process.argv.slice(2);
if (!targetPath || !incomingPath) {
  console.error('Usage: node merge-knowledge-articles-seed.mjs <target> <incoming>');
  process.exit(1);
}

const toIso = () => new Date().toISOString();

async function readJson(path, fallback) {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeState(state) {
  const articles = Array.isArray(state?.articles) ? state.articles : [];
  const nextId = typeof state?.nextId === 'number' && state.nextId > 0 ? state.nextId : 1;
  return { articles, nextId };
}

/** Seed body is the migrated canonical HTML with local public assets. */
function seedHasLocalKnowledgeAssets(body) {
  return typeof body === 'string' && body.includes('/knowledge/article-');
}

/** Leftover Bitrix page chrome that must not stay in article HTML. */
function hasBitrixPageChrome(body) {
  return typeof body === 'string' && /\/devs\/asset\//.test(body);
}

function looksEscapedHtml(body) {
  return typeof body === 'string' && /&lt;(?:\/?[a-z]+|br)\b/i.test(body);
}

function seedHasRenderableHtml(body) {
  return typeof body === 'string' && /<(?:a|br|p|div|img|i|b)\b/i.test(body);
}

/** Bitrix fragments with tags but without a wrapping block — need seed wrap. */
function looksLooseInlineHtml(body) {
  if (typeof body !== 'string' || !body.trim()) return false;
  if (/^\s*<(?:p|div|h[1-4]|ul|ol|blockquote|table|pre)\b/i.test(body)) return false;
  return /<(?:a|br|i|b|img)\b/i.test(body);
}

function shouldRefreshBody(targetArticle, incomingArticle) {
  const incomingBody = incomingArticle?.body;
  if (typeof incomingBody !== 'string' || !incomingBody.trim()) return false;
  const targetBody = targetArticle?.body;
  if (targetBody === incomingBody) return false;
  // Repair Bitrix page chrome left inside article HTML.
  if (hasBitrixPageChrome(targetBody)) return true;
  // First time seed brings migrated local image paths.
  if (seedHasLocalKnowledgeAssets(incomingBody) && !seedHasLocalKnowledgeAssets(targetBody)) {
    return true;
  }
  // Editor used to treat inline HTML as markdown and save tags as text.
  if (looksEscapedHtml(targetBody) && seedHasRenderableHtml(incomingBody)) {
    return true;
  }
  // Pull wrapped seed over loose unwrapped Bitrix HTML.
  if (looksLooseInlineHtml(targetBody) && /^\s*<div\b/i.test(incomingBody)) {
    return true;
  }
  return false;
}

const target = await readJson(targetPath, { articles: [], nextId: 1 });
const incoming = await readJson(incomingPath, { articles: [], nextId: 1 });

const t = normalizeState(target);
const i = normalizeState(incoming);

const targetById = new Map(t.articles.map((a) => [String(a?.id ?? ''), a]).filter(([id]) => id));

const merged = [];
let added = 0;
let refreshedBody = 0;
let retired = 0;
let platformOwned = 0;

const incomingById = new Map(
  i.articles.map((a) => [String(a?.id ?? ''), a]).filter(([id]) => id)
);

for (const targetArticle of t.articles) {
  const id = String(targetArticle?.id ?? '').trim();
  if (id && RETIRED_ARTICLE_IDS.has(id)) {
    retired += 1;
    continue;
  }
  // Drop Bitrix menu stubs / broken rows without title (API ignores them anyway).
  if (!String(targetArticle?.title ?? '').trim()) {
    continue;
  }
  const incomingArticle = id ? incomingById.get(id) : undefined;
  if (!incomingArticle) {
    merged.push(targetArticle);
    continue;
  }

  if (PLATFORM_OWNED_ARTICLE_IDS.has(id)) {
    platformOwned += 1;
    merged.push({
      ...targetArticle,
      title: incomingArticle.title ?? targetArticle.title,
      summary: incomingArticle.summary ?? targetArticle.summary,
      body: incomingArticle.body ?? targetArticle.body,
      tags: incomingArticle.tags ?? targetArticle.tags,
      breadcrumbs: incomingArticle.breadcrumbs ?? targetArticle.breadcrumbs,
      departments: incomingArticle.departments ?? targetArticle.departments,
      status: incomingArticle.status ?? targetArticle.status,
      updatedAt: toIso()
    });
    continue;
  }

  if (shouldRefreshBody(targetArticle, incomingArticle)) {
    refreshedBody += 1;
    merged.push({
      ...targetArticle,
      body: incomingArticle.body,
      coverImage:
        incomingArticle.coverImage !== undefined
          ? incomingArticle.coverImage
          : targetArticle.coverImage,
      updatedAt: toIso()
    });
  } else {
    merged.push(targetArticle);
  }
}

let prunedEmptyTitle = t.articles.length - merged.length - retired;

for (const incomingArticle of i.articles) {
  const id = String(incomingArticle?.id ?? '').trim();
  if (!id) continue;
  if (RETIRED_ARTICLE_IDS.has(id)) continue;
  if (!String(incomingArticle?.title ?? '').trim()) continue;
  if (targetById.has(id)) continue;
  merged.push({
    ...incomingArticle,
    createdAt: incomingArticle.createdAt ?? toIso(),
    updatedAt: incomingArticle.updatedAt ?? incomingArticle.createdAt ?? toIso()
  });
  added += 1;
}

const nextId = Math.max(t.nextId, i.nextId);

await writeFile(targetPath, `${JSON.stringify({ articles: merged, nextId }, null, 2)}\n`, 'utf8');
console.log(
  `knowledge articles merged: added ${added}, refreshed body ${refreshedBody}, platform-owned ${platformOwned}, retired ${retired}, pruned empty title ${Math.max(0, prunedEmptyTitle)}`
);
