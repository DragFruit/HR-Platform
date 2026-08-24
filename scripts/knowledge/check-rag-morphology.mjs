#!/usr/bin/env node
/**
 * Проверка словоформ RAG (esbuild → CJS → кейсы).
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
  entryPoints: [join(frontend, 'server/utils/knowledgeRagLexical.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false
});

const module = { exports: {} };
// eslint-disable-next-line no-new-func
new Function('exports', 'module', 'require', result.outputFiles[0].text)(
  module.exports,
  module,
  requireFromFrontend
);

const { textCoversToken, tokensMatchMorph, stemRu } = module.exports;

assert.equal(textCoversToken('При увольнении сотрудника создается задача', 'уволиться'), true);
assert.equal(textCoversToken('Регламент увольнения сотрудника', 'уволится'), true);
assert.equal(textCoversToken('Правила ухода в отпуск', 'отпуска'), true);
assert.equal(textCoversToken('Доступы AFINA', 'доступ'), true);
assert.equal(textCoversToken('Погода в Москве', 'уволиться'), false);
assert.equal(tokensMatchMorph('уволиться', 'увольнение'), true);
assert.equal(tokensMatchMorph('отпуск', 'отпуска'), true);
assert.equal(tokensMatchMorph('уволиться', 'погода'), false);
assert.equal(tokensMatchMorph('привет', 'приветствие'), false);
assert.equal(tokensMatchMorph('привет', 'приветствия'), false);
assert.ok(stemRu('уволиться').length >= 4);

const intentBuild = esbuild.buildSync({
  entryPoints: [join(frontend, 'app/utils/knowledgeAiIntent.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false
});
const intentModule = { exports: {} };
new Function('exports', 'module', 'require', intentBuild.outputFiles[0].text)(
  intentModule.exports,
  intentModule,
  requireFromFrontend
);
const { detectKbAiChitchat } = intentModule.exports;
assert.equal(detectKbAiChitchat('привет'), true);
assert.equal(detectKbAiChitchat('здравствуйте'), true);
assert.equal(detectKbAiChitchat('как уволиться'), false);

console.log('ok: morphology covers увольнение↔уволиться, отпуск↔отпуска');
console.log('ok: привет ≠ приветствие; greeting skips RAG');
