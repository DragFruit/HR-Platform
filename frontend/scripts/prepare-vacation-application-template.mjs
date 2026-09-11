/**
 * Конвертация бланка «Заявление на отпуск (3).docx» (таблица в шапке, без жёлтых полей)
 * → vacation-application.docx с плейсхолдерами docxtemplater.
 *
 * Usage (from frontend/):
 *   node scripts/prepare-vacation-application-template.mjs [path/to/source.docx]
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import PizZip from 'pizzip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultSource = join(
  process.env.HOME ?? '',
  'Downloads',
  'Telegram Desktop',
  'Заявление на отпуск (3).docx'
);
const sourcePath = process.argv[2] ?? defaultSource;
const outPath = join(__dirname, '../server/templates/vacation-application.docx');
const assetsOutPath = join(__dirname, '../server/assets/templates/vacation-application.docx');

const zip = new PizZip(readFileSync(sourcePath));
const docPath = 'word/document.xml';
let xml = zip.file(docPath).asText();

const replaceExactT = (from, to) => {
  const needle = `>${from}<`;
  const next = `>${to}<`;
  if (!xml.includes(needle)) {
    throw new Error(`Не найден фрагмент w:t: ${JSON.stringify(from)}`);
  }
  xml = xml.replace(needle, next);
};

// Юрлицо в шапке: ООО «ВиБиАй» → ООО «{legal_entity}»
replaceExactT('ВиБиАй', '{legal_entity}');

// Должность (строка «от …»)
replaceExactT(
  '                                                                                                              от __________________________',
  '                                                                                                              от {position}'
);

// ФИО на следующей строке
replaceExactT(
  '                       __________________________',
  '                       {employee_name}'
);

const rPrBody =
  '<w:rPr>' +
  '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
  '</w:rPr>';
/** Подпись «Вид отпуска (…)» в бланке — 7pt (sz=14), не основной кегль. */
const rPrCaption =
  '<w:rPr>' +
  '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
  '<w:sz w:val="14"/><w:szCs w:val="14"/>' +
  '</w:rPr>';

/**
 * «Прошу предоставить ___…» → {vacation_type} (= ежегодный).
 * Кегль как в бланке (без принудительного 12pt).
 */
{
  const askIdx = xml.indexOf('>Прошу предоставить <');
  if (askIdx < 0) throw new Error('Не найден «Прошу предоставить»');
  const pStart = xml.lastIndexOf('<w:p ', askIdx);
  const pEnd = xml.indexOf('</w:p>', askIdx);
  if (pStart < 0 || pEnd < 0) throw new Error('Не найден абзац вида отпуска');
  const para = xml.slice(pStart, pEnd + '</w:p>'.length);
  const pPrMatch = para.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : '';
  const rebuilt =
    `<w:p>` +
    pPr +
    `<w:r>${rPrBody}<w:t xml:space="preserve">Прошу предоставить </w:t></w:r>` +
    `<w:r>${rPrBody}<w:t>{vacation_type}</w:t></w:r>` +
    `</w:p>`;
  xml = xml.slice(0, pStart) + rebuilt + xml.slice(pEnd + '</w:p>'.length);
}

/**
 * Даты: подпись «Вид отпуска (…)» мелким шрифтом + «с {start} по {end} на {days}».
 */
const datesMarker = 'Вид отпуска (ежегодный, без сохранения заработной платы)';
const datesIdx = xml.indexOf(datesMarker);
if (datesIdx < 0) throw new Error('Не найден блок «Вид отпуска»');

{
  const pStart = xml.lastIndexOf('<w:p ', datesIdx);
  const pEnd = xml.indexOf('</w:p>', datesIdx);
  if (pStart < 0 || pEnd < 0) throw new Error('Не найдены границы абзаца дат');
  const para = xml.slice(pStart, pEnd + '</w:p>'.length);
  const pPrMatch = para.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : '';
  // В бланке перед подписью пробелы + sz=14 — сохраняем.
  const captionLead = '                                                                                                 ';
  const rebuilt =
    `<w:p>` +
    pPr +
    `<w:r>${rPrCaption}<w:t xml:space="preserve">${captionLead}${datesMarker}</w:t></w:r>` +
    `<w:r>${rPrBody}<w:t xml:space="preserve">с {start_date}   по {end_date} на {days_count}</w:t></w:r>` +
    `</w:p>`;
  xml = xml.slice(0, pStart) + rebuilt + xml.slice(pEnd + '</w:p>'.length);
}

// Выход на работу
replaceExactT(
  ' на работу _____________________',
  ' на работу {return_date}'
);

const required = [
  '{legal_entity}',
  '{position}',
  '{employee_name}',
  '{vacation_type}',
  '{start_date}',
  '{end_date}',
  '{days_count}',
  '{return_date}'
];
for (const tag of required) {
  if (!xml.includes(tag)) throw new Error(`После конвертации нет ${tag}`);
}

zip.file(docPath, xml);
const bytes = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, bytes);
mkdirSync(dirname(assetsOutPath), { recursive: true });
writeFileSync(assetsOutPath, bytes);

const tmpXml = join(__dirname, '../.tmp-vacation-doc.xml');
writeFileSync(tmpXml, xml);
try {
  execSync(`xmllint --noout ${JSON.stringify(tmpXml)}`, { stdio: 'pipe' });
} catch (err) {
  console.error('document.xml invalid after conversion — aborting');
  console.error(String(err?.stderr || err));
  process.exit(1);
} finally {
  try {
    unlinkSync(tmpXml);
  } catch {
    /* ignore */
  }
}

console.log(`Wrote ${outPath} and ${assetsOutPath}`);
console.log(`Placeholders: ${required.join(', ')}`);
