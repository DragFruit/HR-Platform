/**
 * Быстрая проверка RAG для «шрифты компании» без эмбеддингов Yandex.
 * Запуск: node scripts/test-font-rag.mjs
 */
import {
  distinctiveQueryTokens,
  expandQueryWithSynonyms,
  longestRareToken,
  hasCorpFontsIntent
} from '../server/utils/knowledgeRagLexical.ts';
import { retrieveKnowledgeLexicalFallback } from '../server/utils/knowledgeRag.ts';

const queries = [
  'шрифты компании',
  'корпоративные шрифты',
  'tt hoves pro',
  'фирменный шрифт vbi'
];

console.log('=== lexical intent / tokens ===');
for (const q of queries) {
  const distinctive = distinctiveQueryTokens(q);
  console.log({
    q,
    fontIntent: hasCorpFontsIntent(q),
    distinctive,
    anchor: longestRareToken(distinctive, q),
    expanded: expandQueryWithSynonyms(q).slice(0, 120)
  });
}

console.log('\n=== lexical fallback top-3 ===');
for (const q of ['шрифты компании', 'какой шрифт у компании']) {
  const hits = await retrieveKnowledgeLexicalFallback(q, { topArticles: 3 });
  console.log(
    q,
    '→',
    hits.map((h) => `${h.articleId} (${h.title.slice(0, 40)}, score=${h.score.toFixed(3)})`)
  );
  const top = hits[0]?.articleId;
  console.log(top === 'kb-corp-fonts-vbi' ? 'OK' : `FAIL expected kb-corp-fonts-vbi got ${top}`);
}
