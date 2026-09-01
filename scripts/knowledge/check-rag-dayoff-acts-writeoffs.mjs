#!/usr/bin/env node
/**
 * Локальная проверка: DayOfff (отгул|SaaS) + акты РП (kb-31980) + списания AFINA (kb-28468).
 * Sense + якоря + нарезка секций. Без Yandex/индекса.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
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

const lexical = loadTs('server/utils/knowledgeRagLexical.ts');
const sense = loadTs('server/utils/knowledgeRagSense.ts');
const rag = loadTs('server/utils/knowledgeRag.ts');

const {
  distinctiveQueryTokens,
  longestRareToken,
  rareTokenHeadingHits,
  rareTokenStrength,
  tokenizeForRag,
  lexicalScore,
  hasActsRegulationIntent,
  hasWriteoffAfinaIntent,
  hasContactDirectoryIntent,
  hasUtmTaggingIntent
} = lexical;

const { resolveQuestionSense, clearSenseForQuestion, ambiguousBranchesForQuestion } = sense;
const { chunkArticleText, pickArticleSnippets } = rag;

const DAYOFF_LEAVE = 'kb-30077';
const DAYOFF_SAAS = 'kb-27877';
const ACTS = 'kb-31980';
const WRITEOFF = 'kb-28468';
const CONTACTS = 'kb-20409';
const AFINA = 'kb-20520';
const UTM = 'kb-23420';
const GUEST = 'kb-29864';

const articles = JSON.parse(
  readFileSync(join(frontend, 'server/data/knowledge-articles.json'), 'utf8')
).articles;
const byId = Object.fromEntries(articles.map((a) => [a.id, a]));
for (const id of [DAYOFF_LEAVE, DAYOFF_SAAS, ACTS, WRITEOFF, CONTACTS, AFINA, UTM, GUEST]) {
  assert.ok(byId[id], id);
}

let failed = 0;
function ok(id, cond, detail = '') {
  if (cond) console.log(`ok  ${id}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  }
}

// --- Sense DayOfff ---
const SENSE_CASES = [
  { q: 'взять дейоф', expect: 'dayoff-leave' },
  { q: 'как взять дейофф', expect: 'dayoff-leave' },
  { q: 'оформить day off', expect: 'dayoff-leave' },
  { q: 'войти в dayofff', expect: 'dayoff-saas' },
  { q: 'войти в дейоф', expect: 'dayoff-saas' },
  { q: 'логин в DayOFFF', expect: 'dayoff-saas' },
  { q: 'что такое дейоф', expect: 'ambiguous' },
  { q: 'дейоф', expect: 'ambiguous' },
  { q: 'dayofff', expect: 'ambiguous' },
  // списания ≠ доступы
  { q: 'списания в afina', expect: 'none' },
  { q: 'как зайти в афину', expect: 'access-afina' }
];

for (const c of SENSE_CASES) {
  const r = resolveQuestionSense(c.q);
  const id = r.kind === 'clear' ? r.sense.id : r.kind;
  ok(`sense:${c.q}`, id === c.expect, `got ${JSON.stringify(r)}`);
}

ok(
  'amb-branches-dayoff',
  ambiguousBranchesForQuestion('что такое дейоф').length === 2
);
ok('clear-leave', clearSenseForQuestion('взять дейоф')?.id === 'dayoff-leave');
ok('clear-saas', clearSenseForQuestion('войти в dayofff')?.id === 'dayoff-saas');

// --- Intents ---
ok('intent-acts-yandex', hasActsRegulationIntent('акты яндекс'));
ok('intent-acts-vkr', hasActsRegulationIntent('акты VKR'));
ok('intent-acts-not-actual', !hasActsRegulationIntent('актуальность договора'));
ok('intent-writeoff-afina', hasWriteoffAfinaIntent('списания в afina'));
ok('intent-writeoff-ppc', hasWriteoffAfinaIntent('прочее ppc комиссии'));
ok(
  'intent-acts-not-contacts',
  hasActsRegulationIntent('акты яндекс') && !hasContactDirectoryIntent('акты яндекс')
);
ok('intent-utm-still', hasUtmTaggingIntent('регламент utm'));

// --- Dayoff rare anchor ---
ok(
  'dayoff-anchor-short',
  longestRareToken(distinctiveQueryTokens('дейоф'), 'дейоф') === 'дейоф',
  `got ${longestRareToken(distinctiveQueryTokens('дейоф'), 'дейоф')}`
);

// --- Chunking ---
const actsChunks = chunkArticleText(byId[ACTS].title, byId[ACTS].body);
const woChunks = chunkArticleText(byId[WRITEOFF].title, byId[WRITEOFF].body);
const saasChunks = chunkArticleText(byId[DAYOFF_SAAS].title, byId[DAYOFF_SAAS].body);
ok('acts-chunks', actsChunks.length >= 3, `n=${actsChunks.length}`);
ok('writeoff-chunks', woChunks.length >= 3, `n=${woChunks.length}`);
ok('dayoff-saas-chunks', saasChunks.length >= 3, `n=${saasChunks.length}`);
ok(
  'acts-has-ydirect-section',
  actsChunks.some((t) => /YDirect|Акты Яндекс/i.test(t))
);
ok(
  'acts-has-vkr-section',
  actsChunks.some((t) => /VKR\s*Таргет|Акты ВКР/i.test(t))
);
ok(
  'writeoff-has-ppc',
  woChunks.some((t) => /Прочее\s*\(PPC\)/i.test(t))
);

const vkrQ = 'акты VKR';
const vkrSnips = pickArticleSnippets(
  byId[ACTS].title,
  actsChunks,
  distinctiveQueryTokens(vkrQ),
  tokenizeForRag(vkrQ),
  3,
  vkrQ
);
ok(
  'acts-snippet-vkr',
  /vkr|вкр/i.test(vkrSnips.join('\n')),
  vkrSnips.join('\n').slice(0, 200)
);

const yandexQ = 'акты яндекс директ YDirect';
const yandexSnips = pickArticleSnippets(
  byId[ACTS].title,
  actsChunks,
  distinctiveQueryTokens(yandexQ),
  tokenizeForRag(yandexQ),
  3,
  yandexQ
);
ok(
  'acts-snippet-ydirect',
  /ydirect|яндекс/i.test(yandexSnips.join('\n')),
  yandexSnips.join('\n').slice(0, 200)
);

// --- Hard retrieve across distractors ---
const distractors = [
  byId[DAYOFF_LEAVE],
  byId[DAYOFF_SAAS],
  byId[ACTS],
  byId[WRITEOFF],
  byId[CONTACTS],
  byId[AFINA],
  byId[UTM],
  byId[GUEST]
];
const allChunks = [];
for (const a of distractors) {
  for (const text of chunkArticleText(a.title, a.body)) {
    allChunks.push({ articleId: a.id, title: a.title, text });
  }
}

function hardRetrieve(q) {
  const distinctive = distinctiveQueryTokens(q);
  const anchor = longestRareToken(distinctive, q);
  const lexTokens = tokenizeForRag(q);
  const clear = clearSenseForQuestion(q);
  const amb = ambiguousBranchesForQuestion(q);

  if (clear) {
    const a = byId[clear.articleIds[0]];
    return {
      anchor,
      ambiguous: false,
      hits: [
        {
          articleId: a.id,
          title: a.title,
          snippets: pickArticleSnippets(
            a.title,
            allChunks.filter((c) => c.articleId === a.id).map((c) => c.text),
            distinctive,
            lexTokens,
            3,
            q
          )
        }
      ]
    };
  }
  if (amb.length >= 2) {
    return {
      anchor,
      ambiguous: true,
      hits: amb.map((s) => ({
        articleId: s.articleIds[0],
        title: byId[s.articleIds[0]].title,
        snippets: []
      }))
    };
  }

  const finishPrefer = (hits) => {
    if (hasActsRegulationIntent(q)) {
      const only = hits.filter((h) => h.articleId === ACTS);
      if (only.length) return { anchor, ambiguous: false, hits: only };
      const a = byId[ACTS];
      return {
        anchor,
        ambiguous: false,
        hits: [
          {
            articleId: a.id,
            title: a.title,
            snippets: pickArticleSnippets(
              a.title,
              allChunks.filter((c) => c.articleId === a.id).map((c) => c.text),
              distinctive,
              lexTokens,
              3,
              q
            )
          }
        ]
      };
    }
    if (hasWriteoffAfinaIntent(q)) {
      const only = hits.filter((h) => h.articleId === WRITEOFF);
      if (only.length) return { anchor, ambiguous: false, hits: only };
      const a = byId[WRITEOFF];
      return {
        anchor,
        ambiguous: false,
        hits: [
          {
            articleId: a.id,
            title: a.title,
            snippets: pickArticleSnippets(
              a.title,
              allChunks.filter((c) => c.articleId === a.id).map((c) => c.text),
              distinctive,
              lexTokens,
              3,
              q
            )
          }
        ]
      };
    }
    return { anchor, ambiguous: false, hits };
  };

  if (!anchor) return finishPrefer([]);

  const ranked = allChunks
    .map((chunk) => {
      const blob = `${chunk.title}\n${chunk.text}`;
      return {
        chunk,
        strength: rareTokenStrength(blob, anchor),
        headings: rareTokenHeadingHits(blob, anchor),
        lex: lexicalScore(chunk.title, chunk.text, lexTokens)
      };
    })
    .filter((row) => row.strength > 0)
    .sort((a, b) => b.headings - a.headings || b.strength - a.strength || b.lex - a.lex);

  if (!ranked.length) return finishPrefer([]);

  let preferred = ranked[0].headings > 0 ? ranked.filter((row) => row.headings > 0) : ranked;
  if (hasActsRegulationIntent(q)) {
    const actsOnly = ranked.filter((row) => row.chunk.articleId === ACTS);
    preferred = actsOnly.length ? actsOnly : preferred;
  } else if (hasWriteoffAfinaIntent(q)) {
    const woOnly = ranked.filter((row) => row.chunk.articleId === WRITEOFF);
    preferred = woOnly.length ? woOnly : preferred;
  }

  const byArticle = new Map();
  for (const row of preferred) {
    if (!byArticle.has(row.chunk.articleId)) {
      byArticle.set(row.chunk.articleId, {
        articleId: row.chunk.articleId,
        title: row.chunk.title,
        score: row.strength,
        snippets: [row.chunk.text]
      });
    }
  }
  for (const hit of byArticle.values()) {
    const texts = allChunks.filter((c) => c.articleId === hit.articleId).map((c) => c.text);
    hit.snippets = pickArticleSnippets(hit.title, texts, distinctive, lexTokens, 3, q);
  }
  return finishPrefer([...byArticle.values()].sort((a, b) => b.score - a.score));
}

const HARD = [
  { id: 'hard-leave', q: 'взять дейоф', expectId: DAYOFF_LEAVE },
  { id: 'hard-saas', q: 'войти в dayofff', expectId: DAYOFF_SAAS },
  { id: 'hard-amb', q: 'что такое дейоф', expectIds: [DAYOFF_LEAVE, DAYOFF_SAAS] },
  { id: 'hard-acts-yandex', q: 'акты яндекс', expectId: ACTS },
  { id: 'hard-acts-vkr', q: 'акты VKR', expectId: ACTS },
  { id: 'hard-acts-rp', q: 'акты от рекламных площадок', expectId: ACTS },
  { id: 'hard-writeoff', q: 'списания в afina', expectId: WRITEOFF },
  { id: 'hard-writeoff-ppc', q: 'прочее ppc комиссии', expectId: WRITEOFF },
  { id: 'hard-writeoff-comment', q: 'какое правило списания прочее', expectId: WRITEOFF },
  // regression: contacts / utm / access still ok
  { id: 'hard-contacts-prog', q: 'программатики контакты', expectId: CONTACTS },
  { id: 'hard-utm', q: 'регламент utm', expectId: UTM },
  { id: 'hard-afina-access', q: 'как зайти в афину', expectId: AFINA }
];

for (const c of HARD) {
  const r = hardRetrieve(c.q);
  if (c.expectIds) {
    const ids = r.hits.map((h) => h.articleId);
    ok(
      c.id,
      c.expectIds.every((id) => ids.includes(id)) && r.ambiguous,
      `anchor=${r.anchor} → ${ids.join(',')}`
    );
  } else {
    const top = r.hits[0];
    ok(`${c.id}`, top?.articleId === c.expectId, `anchor=${r.anchor} → ${top?.articleId} ${top?.title}`);
  }
}

// Guard: INDEX_VERSION bumped for section split
const ragSrc = readFileSync(join(frontend, 'server/utils/knowledgeRag.ts'), 'utf8');
assert.match(ragSrc, /const INDEX_VERSION\s*=\s*6/);
assert.match(ragSrc, /ACTS_ARTICLE_ID/);
assert.match(ragSrc, /WRITEOFF_ARTICLE_ID/);
assert.match(ragSrc, /ACTS_SECTION_LINE_START/);
assert.match(ragSrc, /WRITEOFF_SECTION_LINE_START/);
console.log('ok  index-v6-acts-writeoff-dayoff-sections');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`\nok: dayoff + acts + writeoffs (${SENSE_CASES.length} sense + ${HARD.length} hard)`);
