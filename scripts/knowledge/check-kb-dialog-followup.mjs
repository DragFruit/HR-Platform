#!/usr/bin/env node
/**
 * Локальная проверка: уточнения в чате KB («ещё другие», «это все?», «а остальные?»)
 * распознаются как follow-up, склеиваются с темой Programmatic и не уходят в оффтоп.
 *
 *   node scripts/knowledge/check-kb-dialog-followup.mjs
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

const {
  isKbClarifyingFollowUp,
  expandQuestionFromHistory,
  looksLikeWorkplaceKbQuestion,
  shouldSkipRagAsOfftopic,
  shouldRejectModelOfftopic,
  emptyKbReplyMode,
  detectKbAiOfftopic
} = mod.exports;

const history = [
  { role: 'user', text: 'какие есть программатики с кем работаем и кому писать' },
  {
    role: 'assistant',
    text: 'Gnezdo.ru & Natiscope, Data Wise Solution, BYYD, Getintent, HealthScanner…'
  },
  { role: 'user', text: 'это все наши программатики?' },
  {
    role: 'assistant',
    text: 'Ещё: Sape, Hybrid, Slick Jump…'
  }
];

const followUps = [
  'напиши еще другие программатики с которыми работаем',
  'это все наши программатики?',
  'а остальные?',
  'а ещё?',
  'какие ещё?',
  'не названные',
  'ещё другие из списка'
];

for (const q of followUps) {
  assert.equal(isKbClarifyingFollowUp(q), true, `follow-up: ${q}`);
  assert.equal(shouldSkipRagAsOfftopic(q, history), false, `not skip RAG: ${q}`);
  assert.equal(emptyKbReplyMode(q, history), 'not_found', `empty mode: ${q}`);
  const expanded = expandQuestionFromHistory(q, history);
  assert.match(expanded, /программатик/i, `expand keeps topic: ${q} → ${expanded}`);
  assert.equal(
    shouldRejectModelOfftopic(q, history, { hasKbContext: true }),
    true,
    `reject model OFFTOPIC: ${q}`
  );
}

assert.equal(looksLikeWorkplaceKbQuestion('какие есть программатики'), true);
assert.equal(looksLikeWorkplaceKbQuestion('контакты юристов'), true);

// Реальный оффтоп без истории — по-прежнему отказ
assert.equal(detectKbAiOfftopic('какая погода завтра'), true);
assert.equal(shouldSkipRagAsOfftopic('какая погода завтра', []), true);
assert.equal(shouldSkipRagAsOfftopic('расскажи анекдот', history), true);

// Оффтоп с follow-up-маркером в рабочем треде не режем до RAG
assert.equal(shouldSkipRagAsOfftopic('а ещё?', history), false);

console.log('ok: kb dialog follow-up checks passed');
