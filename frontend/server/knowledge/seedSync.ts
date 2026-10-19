import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { knowledgeJsonImports } from '../db/schema';
import type { StateRepo } from '../db/repositories/keyedState';
// тот же скрипт деплой запускает на файле (allowJs)
import { mergeKnowledgeArticlesSeed } from '../../../deploy/scripts/merge-knowledge-articles-seed.mjs';

/**
 * Сид статей из git на стенде с DB_KNOWLEDGE=1. Раньше деплой сливал сид в
 * server/data/knowledge-articles.json (merge-knowledge-articles-seed.mjs); после переезда файл
 * только бэкап, поэтому то же слияние сервер делает в базе при старте. Один раз на версию сида:
 * маркер `seed:<sha256>` в knowledge.json_imports (удалённая админом сид-статья не воскресает
 * на каждом рестарте, только когда сид в git поменялся).
 */

export type KnowledgeSeedStats = {
  added: number;
  refreshedBody: number;
  platformOwned: number;
  retired: number;
  prunedEmptyTitle: number;
};

export type KnowledgeSeedResult =
  | { status: 'already'; marker: string }
  | { status: 'applied'; marker: string; changed: boolean; stats: KnowledgeSeedStats };

export const knowledgeSeedMarker = (seed: unknown) =>
  `seed:${createHash('sha256').update(JSON.stringify(seed)).digest('hex').slice(0, 16)}`;

export function mergeKnowledgeSeed(target: unknown, incoming: unknown): { state: Record<string, unknown>; stats: KnowledgeSeedStats } {
  return mergeKnowledgeArticlesSeed(target, incoming) as { state: Record<string, unknown>; stats: KnowledgeSeedStats };
}

export async function applyKnowledgeSeedToDb(db: Db, repo: StateRepo, seed: unknown): Promise<KnowledgeSeedResult> {
  const marker = knowledgeSeedMarker(seed);
  const [done] = await db.select().from(knowledgeJsonImports).where(eq(knowledgeJsonImports.source, marker));
  if (done) return { status: 'already', marker };

  const out = await repo.mutate(
    async (raw) => {
      const { state, stats } = mergeKnowledgeSeed(raw, seed);
      return { next: state, result: { stats, changed: JSON.stringify(state) !== JSON.stringify(raw) } };
    },
    { reason: 'deploy-seed-merge' }
  );
  const seedCount = Array.isArray((seed as { articles?: unknown })?.articles) ? (seed as { articles: unknown[] }).articles.length : 0;
  await db
    .insert(knowledgeJsonImports)
    .values({ source: marker, fileCount: seedCount, inserted: out.stats.added, skipped: 0 })
    .onConflictDoNothing();
  return { status: 'applied', marker, ...out };
}
