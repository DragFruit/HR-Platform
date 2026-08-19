#!/usr/bin/env node
/**
 * Merge knowledge-articles.json on deploy:
 * - If target already has an article with the same `id` — keep target (do not overwrite admin edits)
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

const target = await readJson(targetPath, { articles: [], nextId: 1 });
const incoming = await readJson(incomingPath, { articles: [], nextId: 1 });

const t = normalizeState(target);
const i = normalizeState(incoming);

const targetById = new Map(t.articles.map((a) => [String(a?.id ?? ''), a]).filter(([id]) => id));

const merged = [...t.articles];
let added = 0;

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
console.log(`knowledge articles merged: added ${added}`);

