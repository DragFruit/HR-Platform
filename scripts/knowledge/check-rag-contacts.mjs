#!/usr/bin/env node
/**
 * Локальная проверка блоков «Контактов»: нужный фрагмент + Programmatic ≠ DayOfff.
 * Без Yandex/индекса. stripHtml / split — как в knowledgeRag.ts.
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

const result = esbuild.buildSync({
  entryPoints: [join(frontend, 'server/utils/knowledgeRagLexical.ts')],
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
  distinctiveQueryTokens,
  longestRareToken,
  rareTokenHeadingHits,
  rareTokenStrength,
  rareDistinctiveTokens,
  textCoversToken,
  tokenizeForRag,
  lexicalScore,
  hasContactDirectoryIntent,
  isContactSectionToken
} = mod.exports;

/** Как в knowledgeRag.ts — с сохранением строк. */
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

function splitPlainSections(plain) {
  const marked = String(plain || '')
    .replace(/_{12,}/g, '\n§\n')
    .replace(CONTACT_SECTION_LINE_START, '\n§\n');
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
  const ranked = chunkTexts
    .map((text, idx) => {
      const lex = lexicalScore(title, text, queryTokens);
      const rareHits = rare.filter((t) => textCoversToken(`${title}\n${text}`, t)).length;
      const distHits = distinctive.filter((t) => textCoversToken(`${title}\n${text}`, t)).length;
      const anchor = longestRareToken(distinctive, question || title);
      const strength = anchor ? rareTokenStrength(`${title}\n${text}`, anchor) : 0;
      return { text, idx, score: strength * 4 + rareHits * 3 + distHits * 0.6 + lex };
    })
    .sort((a, b) => b.score - a.score || a.idx - b.idx);
  return ranked.slice(0, limit).map((r) => r.text);
}

const CONTACTS = 'kb-20409';

function preferContactsDirectory(question, anchor) {
  if (hasContactDirectoryIntent(question)) return true;
  return Boolean(anchor && isContactSectionToken(anchor));
}

function hardRetrieve(q, allChunks) {
  const distinctive = distinctiveQueryTokens(q);
  const anchor = longestRareToken(distinctive, q);
  if (!anchor) return { anchor: null, hits: [] };
  const lexTokens = tokenizeForRag(q);
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
  if (!ranked.length) return { anchor, hits: [] };
  let preferred = ranked[0].headings > 0 ? ranked.filter((row) => row.headings > 0) : ranked;
  if (preferContactsDirectory(q, anchor)) {
    const contactsOnly = ranked.filter(
      (row) =>
        row.strength > 0 &&
        (row.chunk.articleId === CONTACTS || /^контакты$/i.test(row.chunk.title.trim()))
    );
    if (contactsOnly.length) preferred = contactsOnly;
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
    } else if (score > existing.score) {
      existing.score = score;
    }
  }
  for (const hit of byArticle.values()) {
    const texts = allChunks.filter((c) => c.articleId === hit.articleId).map((c) => c.text);
    hit.snippets = pickArticleSnippets(hit.title, texts, distinctive, lexTokens, 3, q);
  }
  let hits = [...byArticle.values()].sort((a, b) => {
    const ha = rareTokenHeadingHits(`${a.title}\n${a.snippets.join('\n')}`, anchor);
    const hb = rareTokenHeadingHits(`${b.title}\n${b.snippets.join('\n')}`, anchor);
    const sa = rareTokenStrength(`${a.title}\n${a.snippets.join('\n')}`, anchor);
    const sb = rareTokenStrength(`${b.title}\n${b.snippets.join('\n')}`, anchor);
    return hb - ha || sb - sa || b.score - a.score;
  });
  const maxHead = Math.max(
    0,
    ...hits.map((h) => rareTokenHeadingHits(`${h.title}\n${h.snippets.join('\n')}`, anchor))
  );
  if (maxHead > 0) {
    hits = hits.filter(
      (h) => rareTokenHeadingHits(`${h.title}\n${h.snippets.join('\n')}`, anchor) > 0
    );
  }
  if (preferContactsDirectory(q, anchor)) {
    const only = hits.filter(
      (h) => h.articleId === CONTACTS || /^контакты$/i.test(h.title.trim())
    );
    if (only.length) hits = only;
  }
  return { anchor, hits: hits.slice(0, 3) };
}

const articles = JSON.parse(
  readFileSync(join(frontend, 'server/data/knowledge-articles.json'), 'utf8')
).articles;
const contacts = articles.find((a) => a.id === 'kb-20409');
assert.ok(contacts, 'kb-20409');

const contactChunks = chunkArticleText(contacts.title, contacts.body);
assert.ok(contactChunks.length >= 10, `chunks=${contactChunks.length}`);

// stripHtml must keep newlines so section heads are detectable
assert.ok(
  stripHtml(contacts.body).includes('\n'),
  'stripHtml must preserve newlines for heading anchors'
);

const CASES = [
  {
    id: 'programmatic',
    q: 'Какие есть Programmatic и кому лучше писать для расчетов?',
    needles: [/programmatic/i, /(sape|hybrid|bidease|морозов|сидоров|виноградов)/i]
  },
  {
    id: 'lawyers',
    q: 'кому писать юристу',
    needles: [/юрист/i, /(марченко|lizmarchenko|данилова)/i]
  },
  {
    id: 'yandex',
    q: 'контакты менеджера Яндекса агентства',
    needles: [/яндекс/i, /(komanova|yandex-team|2728706|vbi\.agency)/i]
  },
  {
    id: 'yandex-short',
    q: 'Менеджер Яндекса',
    needles: [/яндекс/i, /(komanova|yandex-team|2728706|vbi\.agency)/i]
  },
  {
    id: 'google360',
    q: 'кому писать по Google 360',
    needles: [/google\s*360/i, /(alona@totalmediasolutions|totalmedia)/i]
  },
  {
    id: 'designers',
    q: 'кому писать дизайнеру',
    needles: [/дизайнер/i, /(marconde|marcondesign|мирончиков|el_strapone)/i]
  },
  {
    id: 'translators',
    q: 'бюро переводов кому писать',
    needles: [/перевод/i, /(elefteria|zakaz@el-tr)/i]
  },
  {
    id: 'clickru',
    q: 'контакты Click.ru',
    needles: [/click\.ru/i, /(пословск|ap@click)/i]
  },
  {
    id: 'outdoor',
    q: 'наружная реклама в аэропортах контакт',
    needles: [/(аэропорт|телевизор|тиханин)/i]
  }
];

let failed = 0;
for (const c of CASES) {
  const distinctive = distinctiveQueryTokens(c.q);
  const tokens = tokenizeForRag(c.q);
  const snippets = pickArticleSnippets(contacts.title, contactChunks, distinctive, tokens, 3, c.q);
  const blob = snippets.join('\n');
  const ok = c.needles.every((re) => re.test(blob));
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${c.id}`);
    console.error('  q:', c.q);
    console.error('  distinctive:', distinctive);
    console.error('  anchor:', longestRareToken(distinctive, c.q));
    console.error('  top:', snippets[0]?.slice(0, 240).replace(/\s+/g, ' '));
  } else {
    console.log(`ok  ${c.id}  anchor=${longestRareToken(distinctive, c.q)}`);
  }
}

assert.equal(hasContactDirectoryIntent('кому писать юристу'), true);
assert.equal(hasContactDirectoryIntent('комиссия Яндекс Директ'), false);
assert.equal(hasContactDirectoryIntent('Менеджер Яндекса'), true);
assert.equal(
  longestRareToken(
    distinctiveQueryTokens('контакты менеджера Яндекса агентства'),
    'контакты менеджера Яндекса агентства'
  ),
  'яндекса'
);
assert.equal(longestRareToken(distinctiveQueryTokens('кому писать юристу'), 'кому писать юристу'), 'юристу');

const dayoff = articles.find((a) => a.id === 'kb-27877');
const designReg = articles.find((a) => a.id === 'kb-28893');
const lawyersReg = articles.find((a) => a.id === 'kb-29956');
const market = articles.find((a) => a.id === 'kb-29760');

const progQ = 'Какие есть Programmatic и кому писать?';
const progAnchor = longestRareToken(distinctiveQueryTokens(progQ), progQ);
assert.equal(progAnchor, 'programmatic');
const contactsHead = Math.max(
  0,
  ...contactChunks.map((t) => rareTokenHeadingHits(`${contacts.title}\n${t}`, progAnchor))
);
const dayoffChunks = chunkArticleText(dayoff.title, dayoff.body);
const dayoffHead = Math.max(
  0,
  ...dayoffChunks.map((t) => rareTokenHeadingHits(`${dayoff.title}\n${t}`, progAnchor))
);
assert.ok(contactsHead > 0, 'Контакты: heading Programmatic');
assert.equal(dayoffHead, 0, 'DayOfff: no heading Programmatic');
console.log('ok  programmatic-vs-dayoff');

const desQ = 'кому писать дизайнеру';
const desAnchor = longestRareToken(distinctiveQueryTokens(desQ), desQ);
assert.equal(desAnchor, 'дизайнеру');
const desContactsHead = Math.max(
  0,
  ...contactChunks.map((t) => rareTokenHeadingHits(`${contacts.title}\n${t}`, desAnchor))
);
const designChunks = chunkArticleText(designReg.title, designReg.body);
const desRegHead = Math.max(
  0,
  ...designChunks.map((t) => rareTokenHeadingHits(`${designReg.title}\n${t}`, desAnchor))
);
assert.ok(desContactsHead > 0, 'Контакты: heading дизайнеры');
assert.equal(desRegHead, 0, 'Регламент дизайна: no section heading');
console.log('ok  designers-vs-design-reg');

const lawQ = 'кому писать юристу';
const lawAnchor = longestRareToken(distinctiveQueryTokens(lawQ), lawQ);
assert.equal(lawAnchor, 'юристу');
const lawContactsHead = Math.max(
  0,
  ...contactChunks.map((t) => rareTokenHeadingHits(`${contacts.title}\n${t}`, lawAnchor))
);
const lawRegChunks = chunkArticleText(lawyersReg.title, lawyersReg.body);
const lawRegHead = Math.max(
  0,
  ...lawRegChunks.map((t) => rareTokenHeadingHits(`${lawyersReg.title}\n${t}`, lawAnchor))
);
assert.ok(lawContactsHead > 0, 'Контакты: heading юристы');
assert.equal(lawRegHead, 0, 'Регламент юристов: no section heading');
console.log('ok  lawyers-vs-lawyers-reg');

// Cross-article hard path (контролёр: не DayOfff / не маркетплейсы / не регламент дизайна)
const distractors = [contacts, dayoff, designReg, lawyersReg, market].filter(Boolean);
const allChunks = [];
for (const a of distractors) {
  for (const text of chunkArticleText(a.title, a.body)) {
    allChunks.push({ articleId: a.id, title: a.title, text });
  }
}

const HARD = [
  {
    id: 'hard-lawyers',
    q: 'кому писать юристу',
    expectId: CONTACTS,
    forbid: [/dayofff/i, /регламент/i]
  },
  {
    id: 'hard-yandex',
    q: 'Менеджер Яндекса',
    expectId: CONTACTS,
    forbid: [/dayofff/i]
  },
  {
    id: 'hard-designers',
    q: 'кому писать дизайнеру',
    expectId: CONTACTS,
    forbid: [/регламент постановки/i]
  },
  {
    id: 'hard-translators',
    q: 'бюро переводов кому писать',
    expectId: CONTACTS,
    forbid: [/маркетплейс/i]
  },
  {
    id: 'hard-programmatic',
    q: 'Какие есть Programmatic и кому лучше писать для расчетов?',
    expectId: CONTACTS,
    forbid: [/dayofff/i]
  },
  {
    id: 'hard-clickru',
    q: 'контакты Click.ru',
    expectId: CONTACTS,
    forbid: [/dayofff/i]
  }
];

for (const c of HARD) {
  const r = hardRetrieve(c.q, allChunks);
  const top = r.hits[0];
  const titles = r.hits.map((h) => h.title).join(' | ');
  const blob = r.hits.map((h) => `${h.title}\n${h.snippets.join('\n')}`).join('\n');
  const okId = top?.articleId === c.expectId;
  const okForbid = !(c.forbid || []).some((re) => re.test(blob));
  if (!okId || !okForbid) {
    failed += 1;
    console.error(`FAIL ${c.id}`);
    console.error('  anchor:', r.anchor);
    console.error('  hits:', titles || '(none)');
  } else {
    console.log(`ok  ${c.id}  → ${top.articleId}`);
  }
}

// Guard: INDEX_FILE / INDEX_VERSION must exist in knowledgeRag.ts (regression ed7e4a9)
const ragSrc = readFileSync(join(frontend, 'server/utils/knowledgeRag.ts'), 'utf8');
assert.match(ragSrc, /const INDEX_FILE\s*=/);
assert.match(ragSrc, /const INDEX_VERSION\s*=\s*\d+/);
console.log('ok  index-consts-present');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`\nok: contacts section pick (${CASES.length} + hard + guards)`);
