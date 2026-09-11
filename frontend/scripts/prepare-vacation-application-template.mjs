/**
 * One-shot: copy HR Word template and replace yellow-highlighted gaps with docxtemplater tags.
 * Source: user's Downloads; output: server/templates/vacation-application.docx
 *
 * Usage (from frontend/): node scripts/prepare-vacation-application-template.mjs [source.docx]
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import PizZip from 'pizzip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultSource = join(
  process.env.HOME ?? '',
  'Downloads',
  'Заявление на отпуск-3 (2).docx'
);
const sourcePath = process.argv[2] ?? defaultSource;
const outPath = join(__dirname, '../server/templates/vacation-application.docx');
const assetsOutPath = join(__dirname, '../server/assets/templates/vacation-application.docx');

/** Yellow gaps in document order (see server/templates/README.md). */
const TAGS = [
  '{legal_entity}',
  '{from_line}',
  '{start_date}',
  '{end_date}',
  '{days_count}',
  '{return_date}'
];

const zip = new PizZip(readFileSync(sourcePath));
const docPath = 'word/document.xml';
let xml = zip.file(docPath).asText();
let tagIdx = 0;

/**
 * Жёлтая подсветка сидит внутри <w:rPr>…</w:rPr> перед <w:t>___</w:t>.
 * Старый regex вырезал и </w:rPr> → Word не открывал файл.
 * Возвращаем закрытие rPr (+ кегль 11pt) и тег.
 */
xml = xml.replace(
  /<w:highlight w:val="yellow"\/>[\s\S]*?<w:t([^>]*)>(_+)<\/w:t>/g,
  (match, tAttrs) => {
    if (tagIdx >= TAGS.length) return match;
    const tag = TAGS[tagIdx];
    tagIdx += 1;
    return (
      `<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>` +
      `<w:t${tAttrs}>${tag}</w:t>`
    );
  }
);

if (tagIdx !== TAGS.length) {
  console.error(`Expected ${TAGS.length} yellow gaps, converted ${tagIdx}`);
  process.exit(1);
}

zip.file(docPath, xml);
const bytes = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, bytes);
mkdirSync(dirname(assetsOutPath), { recursive: true });
writeFileSync(assetsOutPath, bytes);

// Fail loudly if XML is broken (Word won't open the file).
const tmpXml = join(__dirname, '../.tmp-vacation-doc.xml');
writeFileSync(tmpXml, xml);
try {
  execSync(`xmllint --noout ${JSON.stringify(tmpXml)}`, { stdio: 'pipe' });
} catch (err) {
  console.error('document.xml invalid after conversion — aborting');
  console.error(String(err?.stderr || err));
  process.exit(1);
}

console.log(`Wrote ${outPath} and ${assetsOutPath} (${tagIdx} placeholders, xmllint OK)`);
