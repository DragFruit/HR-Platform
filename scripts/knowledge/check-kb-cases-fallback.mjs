#!/usr/bin/env node
/**
 * Локальная проверка: вопросы про кейсы → фиксированный fallback, без RAG-ложных статей.
 *
 *   node scripts/knowledge/check-kb-cases-fallback.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const { detectKbAiCasesQuestion, KB_AI_CASES_REPLY, detectKbAiOfftopic } = mod.exports;

const EXPECTED =
  'Пока что я не умею работать с кейсами, но уже прохожу обучение! Скоро смогу ответить на все ваши вопросы по ним.';

assert.equal(KB_AI_CASES_REPLY, EXPECTED);

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
}

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

console.log('ok: kb cases fallback detect + exact reply text');
