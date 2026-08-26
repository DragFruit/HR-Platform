#!/usr/bin/env node
/**
 * Локальная проверка: доступы (AFINA / гостевые / продажи) + UTM (kb-23420).
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

const {
  distinctiveQueryTokens,
  longestRareToken,
  rareTokenHeadingHits,
  rareTokenStrength,
  rareDistinctiveTokens,
  textCoversToken,
  tokenizeForRag,
  lexicalScore,
  hasUtmTaggingIntent,
  isUtmSectionToken
} = lexical;

const { resolveQuestionSense, clearSenseForQuestion } = sense;

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&\w+;/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const CONTACT_SECTION_LINE_START =
  /(?:^|\n)\s*(?=(?:Programmatic\b|Юридическая\s+поддержка|Бюро\s+переводов|Дизайнеры\b|Копирайтеры\b|Яндекс\s+Менеджер|Google\s*360|CLICK\s*RU|Наружная\s+реклама))/gi;
const UTM_SECTION_LINE_START =
  /(?:^|\n)\s*(?=(?:Топ ошибок|Коллтрекинги\s+и\s+авторазметка|UIS\/Comagic|Roistat\b|Calltou|Параметр\s+utm_))/gi;
const GUEST_ACCESS_SECTION_LINE_START = /(?:^|\n)\s*(?=Доступ к\s+)/gi;

function splitPlainSections(plain) {
  const marked = String(plain || '')
    .replace(/_{12,}/g, '\n§\n')
    .replace(CONTACT_SECTION_LINE_START, '\n§\n')
    .replace(UTM_SECTION_LINE_START, '\n§\n')
    .replace(GUEST_ACCESS_SECTION_LINE_START, '\n§\n');
  const sections = marked
    .split(/\n§\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sections.length ? sections : [plain];
}

function windowChunks(text, size = 1200, overlap = 150) {
  const t = String(text || '').trim();
  if (!t) return [];
  if (t.length <= size) return [t];
  const out = [];
  let i = 0;
  while (i < t.length) {
    out.push(t.slice(i, i + size));
    if (i + size >= t.length) break;
    i += size - overlap;
  }
  return out;
}

function chunkArticleText(title, bodyHtml) {
  const plain = stripHtml(bodyHtml);
  if (!plain) return [];
  const heading = title.trim();
  const chunks = [];
  for (const section of splitPlainSections(plain)) {
    const labeled = heading && !section.startsWith(heading) ? `${heading}\n\n${section}` : section;
    chunks.push(...windowChunks(labeled));
  }
  return chunks;
}

function pickArticleSnippets(title, chunkTexts, distinctive, queryTokens, limit = 3, question = '') {
  const rare = rareDistinctiveTokens(distinctive);
  const whenCalltracking =
    /когда|обязательн|случа/i.test(question) &&
    /(uis|roistat|calltouch|comagic|коллтрек|колтрек)/i.test(question);
  const ranked = chunkTexts
    .map((text, idx) => {
      const lex = lexicalScore(title, text, queryTokens);
      const rareHits = rare.filter((t) => textCoversToken(`${title}\n${text}`, t)).length;
      const distHits = distinctive.filter((t) => textCoversToken(`${title}\n${text}`, t)).length;
      const anchor = longestRareToken(distinctive, question || title);
      const strength = anchor ? rareTokenStrength(`${title}\n${text}`, anchor) : 0;
      let score = strength * 4 + rareHits * 3 + distHits * 0.6 + lex;
      if (
        whenCalltracking &&
        /существуют случаи|коллтрекинги и авторазметка|невозможно отключить авторазметку|импортировать расходы/i.test(
          text
        )
      ) {
        score += 25;
      }
      return { text, idx, score };
    })
    .sort((a, b) => b.score - a.score || a.idx - b.idx);
  return ranked.slice(0, limit).map((r) => r.text);
}

const AFINA = 'kb-20520';
const GUEST = 'kb-29864';
const SALES = 'kb-25590';
const UTM = 'kb-23420';
const CONTACTS = 'kb-20409';
const HIRING = 'kb-29011';

const articles = JSON.parse(
  readFileSync(join(frontend, 'server/data/knowledge-articles.json'), 'utf8')
).articles;

const byId = Object.fromEntries(articles.map((a) => [a.id, a]));
for (const id of [AFINA, GUEST, SALES, UTM, CONTACTS, HIRING]) {
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

// --- Sense ---
const SENSE_CASES = [
  { q: 'как зайти в афину', expect: 'access-afina' },
  { q: 'где взять доступы к afina', expect: 'access-afina' },
  { q: 'гостевые доступы', expect: 'access-guest' },
  { q: 'как выдать гостевой доступ в Директ', expect: 'access-guest' },
  { q: 'доступы отдела продаж', expect: 'access-sales' },
  { q: 'доступы директ вк', expect: 'access-sales' }
];

for (const c of SENSE_CASES) {
  const r = resolveQuestionSense(c.q);
  const id = r.kind === 'clear' ? r.sense.id : r.kind;
  ok(`sense:${c.expect}`, id === c.expect, `got ${JSON.stringify(r)}`);
}

ok(
  'sense:utm-none',
  resolveQuestionSense('регламент utm').kind === 'none'
);

// --- Short product token utm ---
const utmQ = 'регламент utm';
const dist = distinctiveQueryTokens(utmQ);
ok('utm-in-distinctive', dist.includes('utm'), `dist=${dist.join(',')}`);
ok('utm-anchor', longestRareToken(dist, utmQ) === 'utm');
ok('utm-intent', hasUtmTaggingIntent(utmQ));
ok('utm-intent-calltouch', hasUtmTaggingIntent('когда UIS Roistat Calltouch'));
ok(
  'utm-intent-not-guest',
  !hasUtmTaggingIntent('как дать гостевой доступ в Calltouch')
);
ok('utm-section-token', isUtmSectionToken('calltouch') && isUtmSectionToken('utm'));

// --- Chunking ---
const utmChunks = chunkArticleText(byId[UTM].title, byId[UTM].body);
const guestChunks = chunkArticleText(byId[GUEST].title, byId[GUEST].body);
ok('utm-chunks', utmChunks.length >= 4, `n=${utmChunks.length}`);
ok('guest-chunks', guestChunks.length >= 8, `n=${guestChunks.length}`);

const calltouchQ = 'когда ставить UIS а когда Calltouch';
const callAnchor = longestRareToken(distinctiveQueryTokens(calltouchQ), calltouchQ);
const utmCallHead = Math.max(
  0,
  ...utmChunks.map((t) => rareTokenHeadingHits(`${byId[UTM].title}\n${t}`, callAnchor || 'calltouch'))
);
const guestCallHead = Math.max(
  0,
  ...guestChunks.map((t) =>
    rareTokenHeadingHits(`${byId[GUEST].title}\n${t}`, callAnchor || 'calltouch')
  )
);
ok('utm-has-calltouch-or-section', utmCallHead >= 0 && utmChunks.some((t) => /uis|calltouch|roistat/i.test(t)));

// Snippet pick for UIS/Calltouch → UTM body, not hiring
const utmSnips = pickArticleSnippets(
  byId[UTM].title,
  utmChunks,
  distinctiveQueryTokens(calltouchQ),
  tokenizeForRag(calltouchQ),
  3,
  calltouchQ
);
const utmBlob = utmSnips.join('\n');
ok(
  'utm-snippet-calltouch',
  /(uis|comagic|calltouch|roistat|коллтрек)/i.test(utmBlob) &&
    /существуют случаи|невозможно отключить|импортировать расходы/i.test(utmBlob),
  utmBlob.slice(0, 280)
);

// Hard retrieve across distractors
const distractors = [byId[AFINA], byId[GUEST], byId[SALES], byId[UTM], byId[CONTACTS], byId[HIRING]];
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

  const finishWithSense = (hits) => {
    if (clear) {
      const prefer = hits.find((h) => clear.articleIds.includes(h.articleId));
      if (prefer) return { anchor, hits: [prefer] };
      const a = byId[clear.articleIds[0]];
      if (a) {
        return {
          anchor,
          hits: [
            {
              articleId: a.id,
              title: a.title,
              score: 0.9,
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
    }
    if (hasUtmTaggingIntent(q)) {
      const only = hits.filter((h) => h.articleId === UTM);
      if (only.length) return { anchor, hits: only };
      const a = byId[UTM];
      return {
        anchor,
        hits: [
          {
            articleId: a.id,
            title: a.title,
            score: 0.85,
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
    return { anchor, hits };
  };

  if (!anchor) return finishWithSense([]);

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
  if (!ranked.length) return finishWithSense([]);

  let preferred = ranked[0].headings > 0 ? ranked.filter((row) => row.headings > 0) : ranked;
  if (hasUtmTaggingIntent(q)) {
    const utmOnly = ranked.filter((row) => row.chunk.articleId === UTM);
    preferred = utmOnly.length ? utmOnly : preferred;
  }

  const byArticle = new Map();
  for (const row of preferred) {
    const existing = byArticle.get(row.chunk.articleId);
    const score = Math.min(1, 0.55 + row.strength * 0.08 + row.headings * 0.12 + row.lex * 0.2);
    if (!existing) {
      byArticle.set(row.chunk.articleId, {
        articleId: row.chunk.articleId,
        title: row.chunk.title,
        score,
        snippets: [row.chunk.text]
      });
    } else if (score > existing.score) existing.score = score;
  }
  for (const hit of byArticle.values()) {
    const texts = allChunks.filter((c) => c.articleId === hit.articleId).map((c) => c.text);
    hit.snippets = pickArticleSnippets(hit.title, texts, distinctive, lexTokens, 3, q);
  }
  const hits = [...byArticle.values()].sort((a, b) => b.score - a.score);
  return finishWithSense(hits);
}

const HARD = [
  { id: 'hard-afina-login', q: 'как зайти в афину', expectId: AFINA },
  { id: 'hard-afina-access', q: 'где взять доступы к afina', expectId: AFINA },
  { id: 'hard-guest', q: 'гостевые доступы', expectId: GUEST },
  { id: 'hard-guest-direct', q: 'как выдать гостевой доступ в Директ', expectId: GUEST },
  { id: 'hard-sales', q: 'доступы отдела продаж', expectId: SALES },
  { id: 'hard-sales-direct-vk', q: 'доступы директ вк', expectId: SALES },
  { id: 'hard-utm-mark', q: 'как размечать UTM', expectId: UTM },
  { id: 'hard-utm-reg', q: 'регламент utm', expectId: UTM },
  { id: 'hard-utm-uis', q: 'когда UIS Roistat Calltouch', expectId: UTM },
  { id: 'hard-utm-when', q: 'когда ставить UIS а когда Calltouch', expectId: UTM }
];

for (const c of HARD) {
  const r = hardRetrieve(c.q);
  const top = r.hits[0];
  ok(`${c.id}`, top?.articleId === c.expectId, `anchor=${r.anchor} → ${top?.articleId} ${top?.title}`);
}

// Guard: INDEX_VERSION bumped for section split
const ragSrc = readFileSync(join(frontend, 'server/utils/knowledgeRag.ts'), 'utf8');
assert.match(ragSrc, /const INDEX_VERSION\s*=\s*5/);
assert.match(ragSrc, /UTM_ARTICLE_ID/);
assert.match(ragSrc, /GUEST_ACCESS_SECTION_LINE_START/);
console.log('ok  index-v5-utm-guest-sections');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`\nok: access + utm (${SENSE_CASES.length} sense + ${HARD.length} hard)`);
