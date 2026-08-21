import { rebuildKnowledgeRagIndex } from '../../utils/knowledgeRag';
import { assertCronToken } from '../../utils/cronAuth';

/**
 * Пересборка RAG после деплоя / по cron.
 * Вызов с хоста: X-Cron-Token = CRON_SECRET, предпочтительно с 127.0.0.1.
 */
export default defineEventHandler(async (event) => {
  assertCronToken(event);

  const index = await rebuildKnowledgeRagIndex({ force: true });
  return {
    ok: true,
    chunkCount: index.chunks.length,
    updatedAt: index.updatedAt,
    corpusHash: index.corpusHash
  };
});
