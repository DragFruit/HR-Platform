import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Docxtemplater from 'docxtemplater';
import { useStorage } from '#imports';
import PizZip from 'pizzip';
import {
  isLaborContractEmployee,
  resolveLegalEntityFullName
} from '../../app/data/employeeDirectoryOptions';
import {
  addWorkingDaysIso,
  countInclusiveCalendarDays
} from '../../app/utils/vacationCalendar';

export type VacationApplicationData = {
  employeeName: string;
  position: string;
  legalEntity: string;
  startDate: string;
  endDate: string;
};

/**
 * Боевой шаблон Word (docxtemplater): `server/templates/vacation-application.docx`.
 * Плейсхолдеры — см. `server/templates/README.md`.
 */
export const VACATION_APPLICATION_TEMPLATE_PATH = join(
  process.cwd(),
  'server/templates/vacation-application.docx'
);

const formatRuDate = (iso: string): string => {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  // ru-RU уже даёт «… 2026 г.» — второй «г.» не добавляем.
  return date
    .toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    .replace(/\s*г\.?\s*$/u, '')
    .trim()
    .concat(' г.');
};

/** Ширины полей как прочерки в бланке — чтобы подписи снизу совпадали с датами. */
const BLANK_START_WIDTH = 21;
const BLANK_END_WIDTH = 23;
const BLANK_DAYS_WIDTH = 10;
/** Figure space ≈ ширина цифры/прочерка в Times New Roman (обычный пробел уже). */
const FIELD_PAD = '\u2007';

const padBlankField = (value: string, width: number): string => {
  const text = value.trim();
  if (text.length >= width) return `${text} `;
  return text + FIELD_PAD.repeat(width - text.length);
};

const buildFromLine = (position: string, employeeName: string): string => {
  const pos = position.trim();
  const name = employeeName.trim();
  if (pos && name) return `${pos} ${name}`;
  return name || pos || '—';
};

const buildTemplatePayload = (data: VacationApplicationData) => {
  const days = countInclusiveCalendarDays(data.startDate, data.endDate);
  const returnIso = addWorkingDaysIso(data.endDate, 1);

  return {
    legal_entity: resolveLegalEntityFullName(data.legalEntity) || '—',
    from_line: buildFromLine(data.position, data.employeeName),
    employee_name: data.employeeName.trim() || '—',
    position: data.position.trim() || '—',
    vacation_type: 'ежегодный',
    start_date: padBlankField(formatRuDate(data.startDate), BLANK_START_WIDTH),
    end_date: padBlankField(formatRuDate(data.endDate), BLANK_END_WIDTH),
    days_count: padBlankField(String(days), BLANK_DAYS_WIDTH),
    return_date: formatRuDate(returnIso)
  };
};

const BUNDLED_TEMPLATE_KEY = 'server:templates:vacation-application.docx';

const toBuffer = (raw: unknown): Buffer => {
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw);
  if (typeof raw === 'string') return Buffer.from(raw, 'binary');
  throw new Error('Не удалось прочитать шаблон заявления');
};

const readTemplateBytes = async (): Promise<Buffer> => {
  const bundled = await useStorage('assets').getItem(BUNDLED_TEMPLATE_KEY);
  if (bundled) return toBuffer(bundled);

  await access(VACATION_APPLICATION_TEMPLATE_PATH);
  return readFile(VACATION_APPLICATION_TEMPLATE_PATH);
};

const buildFromTemplateFile = async (data: VacationApplicationData): Promise<Buffer> => {
  const templateBytes = await readTemplateBytes();
  const zip = new PizZip(templateBytes);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' }
  });

  doc.render(buildTemplatePayload(data));

  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};

export async function buildVacationApplicationDocx(data: VacationApplicationData): Promise<Buffer> {
  try {
    return await buildFromTemplateFile(data);
  } catch (err) {
    if (err instanceof Error && err.message.includes('Не удалось прочитать шаблон')) {
      throw err;
    }
    const missing =
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (missing) {
      throw new Error(
        'Шаблон заявления не найден: server/templates/vacation-application.docx. ' +
          'Запустите node scripts/prepare-vacation-application-template.mjs'
      );
    }
    throw err;
  }
}

export { isLaborContractEmployee };

export const vacationApplicationFilename = (employeeName: string, startDate: string): string => {
  const safeName = employeeName.replace(/[^\p{L}\p{N}\-_]+/gu, '_').replace(/_+/g, '_');
  return `Заявление_на_отпуск_${safeName}_${startDate}.docx`;
};
