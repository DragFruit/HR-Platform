import { requireRole } from '../../utils/requireRole';
import { rebuildKnowledgeRagIndex } from '../../utils/knowledgeRag';

/** Админ: пересобрать индекс поиска по смыслу. */
export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);

  const index = await rebuildKnowledgeRagIndex({ force: true });
  return {
    ok: true,
    chunks: index.chunks.length,
    updatedAt: index.updatedAt,
    corpusHash: index.corpusHash
  };
});
