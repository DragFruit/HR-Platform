#!/usr/bin/env node
/**
 * Sense отпуска: Bitrix + Vibe по аудитории; без Yandex/индекса.
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
    entryPoints: [join(frontend, entry)],
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

const {
  resolveQuestionSense,
  clearSenseForQuestion,
  vacationSenseFromViewer,
  VACATION_DIGITAL_ARTICLE_IDS,
  VACATION_SEO_ARTICLE_IDS,
  VACATION_OTHER_ARTICLE_IDS,
  orderHitsForCitations
} = {
  ...loadTs('server/utils/knowledgeRagSense.ts'),
  orderHitsForCitations: loadTs('server/utils/knowledgeRag.ts').orderHitsForCitations
};

let failed = 0;
function ok(name, cond) {
  if (cond) {
    console.log(`ok  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

const dig = clearSenseForQuestion('как уйти в отпуск в digital');
ok('digital-signal-clear', dig?.id === 'vac-digital');
ok(
  'digital-signal-both',
  dig &&
    VACATION_DIGITAL_ARTICLE_IDS.every((id) => dig.articleIds.includes(id)) &&
    dig.articleIds.length === 2
);

const seo = clearSenseForQuestion('отпуск SEO SERM');
ok('seo-signal-clear', seo?.id === 'vac-seo');
ok(
  'seo-signal-both',
  seo && VACATION_SEO_ARTICLE_IDS.every((id) => seo.articleIds.includes(id))
);

ok(
  'plain-no-viewer-none',
  resolveQuestionSense('как уйти в отпуск').kind === 'none'
);

const digViewer = clearSenseForQuestion('как взять отпуск', {
  viewer: { role: 'employee', department: 'Digital' }
});
ok('digital-viewer', digViewer?.id === 'vac-digital');
ok(
  'digital-viewer-both',
  digViewer && VACATION_DIGITAL_ARTICLE_IDS.every((id) => digViewer.articleIds.includes(id))
);

const other = vacationSenseFromViewer({ role: 'employee', department: 'DEV' });
ok('other-viewer', other?.id === 'vac-other');
ok(
  'other-viewer-vibe-only',
  other &&
    other.articleIds.length === 1 &&
    other.articleIds[0] === VACATION_OTHER_ARTICLE_IDS[0]
);

const ordered = orderHitsForCitations(
  [
    { articleId: 'rel', title: 'похожая', score: 0.9, snippets: [] },
    { articleId: 'kb-21301', title: 'Bitrix', score: 0.5, snippets: [] },
    { articleId: 'kb-vibe-vacations-digital', title: 'Vibe', score: 0.4, snippets: [] }
  ],
  ['kb-21301', 'kb-vibe-vacations-digital']
);
ok(
  'citations-used-first',
  ordered.map((h) => h.articleId).join(',') ===
    'kb-21301,kb-vibe-vacations-digital,rel'
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall ok');
