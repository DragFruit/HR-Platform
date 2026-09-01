#!/usr/bin/env node
/**
 * Локальная проверка: stub «не умею работать с кейсами» снят;
 * вопросы про кейсы детектятся, но не блокируют RAG.
 *
 *   node scripts/knowledge/check-kb-cases-fallback.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const frontend = join(root, 'frontend');
const requireFromFrontend = createRequire(join(frontend, 'package.json'));
const esbuild = requireFromFrontend('esbuild');

const result = esbuild.buildSync({
  entryPoints: [join(frontend, 'app/utils/knowledgeAiIntent.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false
});
const mod = { exports: {} };
new Function('exports', 'module', 'require', result.outputFiles[0].text)(
  mod.exports,
  mod,
  requireFromFrontend
);

const {
  detectKbAiCasesQuestion,
  detectKbAiEcomTopic,
  KB_AI_CASES_REPLY,
  detectKbAiOfftopic,
  looksLikeWorkplaceKbQuestion
} = mod.exports;

assert.equal(KB_AI_CASES_REPLY, '', 'stub reply must be empty (disabled)');

const positives = [
  'где взять кейс по авто тематике?',
  'Кейсы по авто',
  'нужен кейс Грузовичков',
  'есть ли кейсы?',
  'покажи case study по retail',
  'где case-studies?'
];

for (const q of positives) {
  assert.equal(detectKbAiCasesQuestion(q), true, `detect cases: ${q}`);
  assert.equal(looksLikeWorkplaceKbQuestion(q), true, `workplace: ${q}`);
}

assert.equal(detectKbAiEcomTopic('нужен кейс ecom, проблема с ROAS / корзиной'), true);
assert.equal(detectKbAiEcomTopic('екоммерс клиент'), true);

const negatives = [
  'кому писать по авито настройке?',
  'регламент UTM',
  'кто руководит отделом продаж',
  'привет',
  'какие есть программатики'
];

for (const q of negatives) {
  assert.equal(detectKbAiCasesQuestion(q), false, `not cases: ${q}`);
  assert.equal(detectKbAiOfftopic(q), false, `not offtopic: ${q}`);
}

const askSrc = readFileSync(join(frontend, 'server/api/knowledge/yandex-ask.post.ts'), 'utf8');
assert.equal(
  /KB_AI_CASES_REPLY/.test(askSrc),
  false,
  'yandex-ask must not short-circuit on KB_AI_CASES_REPLY'
);
assert.equal(
  /detectKbAiCasesQuestion\(question\)/.test(askSrc),
  false,
  'yandex-ask must not block cases before RAG'
);

const clientSrc = readFileSync(join(frontend, 'app/composables/useKnowledgeAiAnswer.ts'), 'utf8');
assert.equal(
  /KB_AI_CASES_REPLY/.test(clientSrc),
  false,
  'client must not short-circuit on cases stub'
);

const articles = JSON.parse(
  readFileSync(join(frontend, 'server/data/knowledge-articles.json'), 'utf8')
);
const caseArts = (articles.articles || []).filter((a) => String(a.id || '').startsWith('kb-case-ecom-'));
assert.ok(caseArts.length >= 12, `expected ≥12 ecom case articles, got ${caseArts.length}`);
for (const a of caseArts) {
  assert.equal(a.status, 'published', a.id);
  assert.deepEqual(a.departments, [], `${a.id} must be company-wide`);
}

console.log('ok: cases stub removed; detect + ecom articles seeded');
