import { requireRole } from '../../../utils/requireRole';
import { retrieveKnowledgeByMeaning } from '../../../utils/knowledgeRag';
import { KNOWLEDGE_RAG_EVAL_CASES } from '../../../utils/knowledgeRagEvalCases';
import { isRewriteSafe, expandQueryWithSynonyms } from '../../../utils/knowledgeRagLexical';

type CaseResult = {
  caseId: string;
  query: string;
  kind: 'canonical' | 'paraphrase';
  ok: boolean;
  hitIds: string[];
  expectAny: string[];
};

/**
 * Админ: прогон кейсов на перефразах (retrieval only, без ответа GPT).
 * Долго при холодном индексе — сначала лучше rag-reindex.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);

  // Быстрая проверка правил переформулировки (без Yandex).
  const safety = {
    keepGood: isRewriteSafe('как уйти в отпуск в digital', 'как оформить отпуск в digital'),
    rejectDrift: !isRewriteSafe('как уйти в отпуск в digital', 'как настроить рекламу в Яндекс Директ'),
    expandDayoff: expandQueryWithSynonyms('взять dayoff').toLowerCase().includes('дейоф') &&
      !expandQueryWithSynonyms('взять dayoff').toLowerCase().includes('отгул')
  };

  const results: CaseResult[] = [];
  let passed = 0;
  let total = 0;

  for (const c of KNOWLEDGE_RAG_EVAL_CASES) {
    const queries: { text: string; kind: 'canonical' | 'paraphrase' }[] = [
      { text: c.canonical, kind: 'canonical' },
      ...c.paraphrases.map((text) => ({ text, kind: 'paraphrase' as const }))
    ];

    for (const q of queries) {
      total += 1;
      const hits = await retrieveKnowledgeByMeaning(q.text, { topArticles: 3 });
      const hitIds = hits.map((h) => h.articleId);
      let ok: boolean;
      if (!c.expectAny.length) {
        // offtopic: не считаем провалом, если пусто; провал если в топе «случайная» сильная статья —
        // мягко: ok если пусто или score < 0.45 у первого
        ok = !hits.length || (hits[0]?.score ?? 0) < 0.45;
      } else {
        ok = c.expectAny.some((id) => hitIds.includes(id));
      }
      if (ok) passed += 1;
      results.push({
        caseId: c.id,
        query: q.text,
        kind: q.kind,
        ok,
        hitIds,
        expectAny: c.expectAny
      });
    }
  }

  return {
    ok: passed === total && safety.keepGood && safety.rejectDrift && safety.expandDayoff,
    passed,
    total,
    safety,
    results
  };
});
