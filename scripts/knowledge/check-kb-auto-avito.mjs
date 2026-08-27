#!/usr/bin/env node
/**
 * Проверка: авто (машины) ≠ Авито; кейсы + авто → fallback кейсов.
 *
 *   node scripts/knowledge/check-kb-auto-avito.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const frontend = join(root, 'frontend');
const requireFromFrontend = createRequire(join(frontend, 'package.json'));
const esbuild = requireFromFrontend('esbuild');

function loadTs(entry) {
  const result = esbuild.buildSync({
    entryPoints: [entry],
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
  return mod.exports;
}

const intent = loadTs(join(frontend, 'app/utils/knowledgeAiIntent.ts'));
const sense = loadTs(join(frontend, 'server/utils/knowledgeRagSense.ts'));
const lexical = loadTs(join(frontend, 'server/utils/knowledgeRagLexical.ts'));

const {
  detectKbAiCasesQuestion,
  KB_AI_CASES_REPLY
} = intent;
const {
  mentionsAutoVehicles,
  mentionsAvitoMarketplace,
  shouldSuppressAvitoForAutoQuestion,
  isAvitoFocusedArticle,
  applyAvitoAutoScoreAdjust
} = sense;
const { textCoversToken } = lexical;

assert.equal(
  KB_AI_CASES_REPLY,
  'Пока что я не умею работать с кейсами, но уже прохожу обучение! Скоро смогу ответить на все ваши вопросы по ним.'
);

const autoQs = [
  'где взять кейс по авто тематике?',
  'кейс по авто',
  'автотематика клиента',
  'сегмент авто',
  'реклама автомобилей'
];

for (const q of autoQs) {
  assert.equal(mentionsAutoVehicles(q), true, `auto vehicles: ${q}`);
  assert.equal(mentionsAvitoMarketplace(q), false, `not avito: ${q}`);
  assert.equal(shouldSuppressAvitoForAutoQuestion(q), true, `suppress avito: ${q}`);
}

assert.equal(detectKbAiCasesQuestion('где взять кейс по авто тематике?'), true);

const avitoQs = ['как настроить авито', 'специалисты Avito', 'регламент авито запуск'];
for (const q of avitoQs) {
  assert.equal(mentionsAvitoMarketplace(q), true, `avito: ${q}`);
  assert.equal(shouldSuppressAvitoForAutoQuestion(q), false, `keep avito: ${q}`);
}

// «авто» внутри «авторизация» — не автотематика
assert.equal(mentionsAutoVehicles('авторизация в dayofff'), false);
assert.equal(mentionsAutoVehicles('коллтрекинги и авторазметка'), false);

// lexical: «авто» не матчит «авито» / «авторизация»
assert.equal(textCoversToken('[Специалисты] Авито настройка и запуск', 'авто'), false);
assert.equal(textCoversToken('Авторизация осуществляется по логину', 'авто'), false);
assert.equal(textCoversToken('автотематика и машины', 'авто'), true);
assert.equal(textCoversToken('Авито настройка', 'авито'), true);

assert.equal(isAvitoFocusedArticle('kb-30126', 'x'), true);
assert.equal(isAvitoFocusedArticle('kb-1', '[Специалисты] Авито настройка'), true);
assert.equal(isAvitoFocusedArticle('kb-1', 'Контакты'), false);

const demoted = applyAvitoAutoScoreAdjust('kb-30126', 'Авито', 0.9, 'кейс по авто');
assert.ok(demoted < 0.1, `demote avito score, got ${demoted}`);
assert.equal(
  applyAvitoAutoScoreAdjust('kb-30126', 'Авито', 0.9, 'настройка авито'),
  0.9
);

console.log('ok: auto≠avito + cases+auto fallback detect');
