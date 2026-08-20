#!/usr/bin/env node
/**
 * Merge knowledge-articles.json on deploy:
 * - If target already has an article with the same `id` — keep target metadata
 *   (do not wipe admin edits), but refresh `body` / `coverImage` from seed when
 *   the seed carries local `/knowledge/...` assets or the target still has
 *   Bitrix page chrome (`/devs/asset/...` link/script).
 * - Otherwise — add incoming article from seed.
 *
 * Usage:
 *   node merge-knowledge-articles-seed.mjs <target.json> <incoming.json>
 */
import { readFile, writeFile } from 'node:fs/promises';

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

const incomingById = new Map(
  i.articles.map((a) => [String(a?.id ?? ''), a]).filter(([id]) => id)
);

for (const targetArticle of t.articles) {
  const id = String(targetArticle?.id ?? '').trim();
  const incomingArticle = id ? incomingById.get(id) : undefined;
  if (!incomingArticle) {
    merged.push(targetArticle);
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

for (const incomingArticle of i.articles) {
  const id = String(incomingArticle?.id ?? '').trim();
  if (!id) continue;
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
console.log(`knowledge articles merged: added ${added}, refreshed body ${refreshedBody}`);
