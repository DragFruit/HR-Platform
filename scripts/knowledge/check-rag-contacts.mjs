#!/usr/bin/env node
/**
 * Локальная проверка блоков «Контактов»: нужный фрагмент + Programmatic ≠ DayOfff.
 * Без Yandex/индекса.
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
  lexicalScore
} = mod.exports;

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\r/g, '');
}

function splitPlainSections(plain) {
  const marked = String(plain || '')
    .replace(/_{12,}/g, '\n§\n')
    .replace(/(?:^|\n)\s*(?=Programmatic\b)/gi, '\n§\n');
  const sections = marked
    .split(/\n§\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sections.length ? sections : [plain];
}

function windowChunks(text, size = 900, overlap = 120) {
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

function pickArticleSnippets(title, chunkTexts, distinctive, queryTokens, limit = 3) {
  const rare = rareDistinctiveTokens(distinctive);
  const ranked = chunkTexts
    .map((text, idx) => {
      const lex = lexicalScore(title, text, queryTokens);
      const rareHits = rare.filter((t) => textCoversToken(`${title}\n${text}`, t)).length;
      const distHits = distinctive.filter((t) => textCoversToken(`${title}\n${text}`, t)).length;
      const anchor = longestRareToken(distinctive);
      const strength = anchor ? rareTokenStrength(`${title}\n${text}`, anchor) : 0;
      return { text, idx, score: strength * 4 + rareHits * 3 + distHits * 0.6 + lex };
    })
    .sort((a, b) => b.score - a.score || a.idx - b.idx);
  return ranked.slice(0, limit).map((r) => r.text);
}

const articles = JSON.parse(
  readFileSync(join(frontend, 'server/data/knowledge-articles.json'), 'utf8')
).articles;
const contacts = articles.find((a) => a.id === 'kb-20409');
assert.ok(contacts, 'kb-20409');

const contactChunks = chunkArticleText(contacts.title, contacts.body);
assert.ok(contactChunks.length >= 10, `chunks=${contactChunks.length}`);

const CASES = [
  {
    id: 'programmatic',
    q: 'Какие есть Programmatic и кому лучше писать для расчетов?',
    needles: [/programmatic/i, /(sape|hybrid|bidease|морозов|сидоров|виноградов)/i]
  },
  {
    id: 'lawyers',
    q: 'кому писать юристу контакты',
    needles: [/юрист/i, /(марченко|lizmarchenko|данилова)/i]
  },
  {
    id: 'yandex',
    q: 'контакты менеджера Яндекса агентства',
    needles: [/яндекс/i, /(komanova|yandex-team|2728706|vbi\.agency)/i]
  },
  {
    id: 'google360',
    q: 'кому писать по Google 360',
    needles: [/google\s*360/i, /(alona@totalmediasolutions|totalmedia)/i]
  },
  {
    id: 'designers',
    q: 'контакты дизайнеров',
    needles: [/дизайнер/i, /(marconde|marcondesign)/i]
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
  const snippets = pickArticleSnippets(contacts.title, contactChunks, distinctive, tokens, 3);
  const blob = snippets.join('\n');
  const ok = c.needles.every((re) => re.test(blob));
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${c.id}`);
    console.error('  q:', c.q);
    console.error('  distinctive:', distinctive);
    console.error('  top:', snippets[0]?.slice(0, 240).replace(/\s+/g, ' '));
  } else {
    console.log(`ok  ${c.id}`);
  }
}

const dayoff = articles.find((a) => a.id === 'kb-27877');
const anchor = longestRareToken(
  distinctiveQueryTokens('Какие есть Programmatic и кому писать?')
);
assert.equal(anchor, 'programmatic');
const contactsHead = Math.max(
  0,
  ...contactChunks.map((t) => rareTokenHeadingHits(`${contacts.title}\n${t}`, anchor))
);
const dayoffChunks = chunkArticleText(dayoff.title, dayoff.body);
const dayoffHead = Math.max(
  0,
  ...dayoffChunks.map((t) => rareTokenHeadingHits(`${dayoff.title}\n${t}`, anchor))
);
assert.ok(contactsHead > 0, 'Контакты: heading Programmatic');
assert.equal(dayoffHead, 0, 'DayOfff: no heading Programmatic');
console.log('ok  programmatic-vs-dayoff');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`\nok: contacts section pick (${CASES.length} + dayoff guard)`);
