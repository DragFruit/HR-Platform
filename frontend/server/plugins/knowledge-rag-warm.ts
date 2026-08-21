/**
 * Прогрев RAG-индекса базы знаний после старта процесса (деплой / restart).
 * Первый пользователь не ждёт холодной сборки, если индекс уже актуален или успел прогреться.
 */
import { rebuildKnowledgeRagIndex } from '../utils/knowledgeRag';

export default defineNitroPlugin(() => {
  // Не блокируем listen: эмбеддинги могут идти минуты
  setTimeout(() => {
    void rebuildKnowledgeRagIndex()
      .then((index) => {
        console.info(
          `[knowledge-rag] warm ok chunks=${index.chunks.length} updatedAt=${index.updatedAt}`
        );
      })
      .catch((err) => {
        console.warn('[knowledge-rag] warm failed', err);
      });
  }, 1500);
});
