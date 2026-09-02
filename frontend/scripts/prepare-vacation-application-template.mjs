/**
 * One-shot: copy HR Word template and replace yellow-highlighted gaps with docxtemplater tags.
 * Source: user's Downloads; output: server/templates/vacation-application.docx
 *
 * Usage (from frontend/): node scripts/prepare-vacation-application-template.mjs [source.docx]
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

xml = xml.replace(
  /<w:highlight w:val="yellow"\/>[\s\S]*?<w:t([^>]*)>(_+)<\/w:t>/g,
  (match, tAttrs, underscores) => {
    if (tagIdx >= TAGS.length) return match;
    const tag = TAGS[tagIdx];
    tagIdx += 1;
    return `<w:t${tAttrs}>${tag}</w:t>`;
  }
);

if (tagIdx !== TAGS.length) {
  console.error(`Expected ${TAGS.length} yellow gaps, converted ${tagIdx}`);
  process.exit(1);
}

zip.file(docPath, xml);
const bytes = zip.generate({ type: 'nodebuffer' });
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, bytes);
mkdirSync(dirname(assetsOutPath), { recursive: true });
writeFileSync(assetsOutPath, bytes);
console.log(`Wrote ${outPath} and ${assetsOutPath} (${tagIdx} placeholders)`);
