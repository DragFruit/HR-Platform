import { requireRole } from '../../../utils/requireRole';
import { retrieveKnowledgeByMeaning } from '../../../utils/knowledgeRag';
import { KNOWLEDGE_RAG_EVAL_CASES } from '../../../utils/knowledgeRagEvalCases';
import { expandDayoffBySense, isRewriteSafe, expandQueryWithSynonyms } from '../../../utils/knowledgeRagLexical';
import { guessDayoffSense } from '../../../utils/knowledgeRagSense';

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

  const safety = {
    keepGood: isRewriteSafe('как уйти в отпуск в digital', 'как оформить отпуск в digital'),
    rejectDrift: !isRewriteSafe('как уйти в отпуск в digital', 'как настроить рекламу в Яндекс Директ'),
    leaveSense: guessDayoffSense('как взять дейоф') === 'leave',
    saasSense: guessDayoffSense('как войти в дейоф') === 'saas',
    ambiguousSense: guessDayoffSense('что такое дейоф') === 'ambiguous',
    leaveExpand: expandDayoffBySense('как взять дейоф', 'leave').includes('отгул'),
    saasSpelling: expandQueryWithSynonyms('dayofff вход').toLowerCase().includes('дейофф')
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

  const safetyOk = Object.values(safety).every(Boolean);
  return {
    ok: passed === total && safetyOk,
    passed,
    total,
    safety,
    results
  };
});
