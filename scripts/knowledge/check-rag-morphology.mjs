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

const { textCoversToken, tokensMatchMorph, stemRu, distinctiveQueryTokens, hitCoversDistinctiveTokens, expandQueryWithSynonyms } = module.exports;

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

assert.equal(textCoversToken('Programmatic (focus on astralab; solta)', 'программатики'), true);
assert.equal(
  textCoversToken('partners@metrika.ru расчеты по площадкам Яндекс', 'программатики'),
  false
);
const distinctive = distinctiveQueryTokens(
  'Какие есть программатики и кому лучше писать для расчетов?'
);
assert.ok(distinctive.includes('программатики'));
assert.ok(!distinctive.includes('писать'));
assert.equal(
  hitCoversDistinctiveTokens('Контакты', ['partners@metrika.ru для расчетов'], distinctive),
  false
);
assert.equal(
  hitCoversDistinctiveTokens('Контакты', ['Programmatic focus on astralab solta adheads hybrid'], distinctive),
  true
);
assert.ok(expandQueryWithSynonyms('программатики').toLowerCase().includes('programmatic'));

const { rareTokenStrength, rareTokenHeadingHits } = module.exports;
assert.ok(
  rareTokenStrength(
    'Контакты\n\nProgrammatic на базе данных соцсетей Hybrid astralab',
    'programmatic'
  ) >= 2
);
assert.ok(
  rareTokenStrength(
    'PPC — google ads, programmatic, аналитика, геосервисы',
    'programmatic'
  ) <
    rareTokenStrength(
      'Контакты\n\nProgrammatic на базе данных соцсетей',
      'programmatic'
    )
);
// подстрока «программатик» ≠ отдельное слово внутри «программатики»
assert.equal(
  rareTokenStrength('карты, программатики, озон', 'programmatic'),
  rareTokenStrength('карты, программатики, озон', 'программатики')
);
assert.ok(rareTokenHeadingHits('Контакты\n\nProgrammatic Sape', 'programmatic') >= 1);
assert.equal(rareTokenHeadingHits('google ads, programmatic, аналитика', 'programmatic'), 0);
// ложный «заголовок» после разреза mid-line больше не создаём — strength mid-body = 1
assert.equal(
  rareTokenStrength('DayOfff\n\nprogrammatic, аналитика, геосервисы', 'programmatic'),
  1
);
assert.ok(rareTokenHeadingHits('Контакты\n\nДизайнеры\nАнтон', 'дизайнеру') >= 1);
assert.ok(rareTokenHeadingHits('Контакты\n\nЮридическая поддержка / Юристы\nЛиза', 'юристу') >= 1);
assert.equal(
  rareTokenHeadingHits('Регламент постановки задач по дизайну\nШаг 1', 'дизайнеру'),
  0
);

const { longestRareToken, hasContactDirectoryIntent } = module.exports;
assert.equal(hasContactDirectoryIntent('кому писать юристу'), true);
assert.equal(
  longestRareToken(
    distinctiveQueryTokens('контакты менеджера Яндекса агентства'),
    'контакты менеджера Яндекса агентства'
  ),
  'яндекса'
);

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
console.log('ok: programmatic ≠ metrika partners for distinctive cover');
