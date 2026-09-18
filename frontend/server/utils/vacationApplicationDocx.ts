import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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

const ruDate = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/\s*г\.?\s*$/u, '')
    .trim()
    .concat(' г.');
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const toBuffer = (raw: unknown): Buffer => {
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw);
  if (typeof raw === 'string') return Buffer.from(raw, 'binary');
  throw new Error('Не удалось прочитать шаблон заявления');
};

async function readTemplate(): Promise<Buffer> {
  const bundled = await useStorage('assets').getItem('server:templates:vacation-application.docx');
  if (bundled) return toBuffer(bundled);
  return readFile(join(process.cwd(), 'server/assets/templates/vacation-application.docx'));
}

/** Подстановка плейсхолдеров через PizZip (бланк с цельными `{…}` в XML). */
export async function buildVacationApplicationDocx(data: VacationApplicationData): Promise<Buffer> {
  const zip = new PizZip(await readTemplate());
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('В шаблоне нет word/document.xml');

  const values: Record<string, string> = {
    legal_entity: resolveLegalEntityFullName(data.legalEntity) || '—',
    employee_name: data.employeeName.trim() || '—',
    position: data.position.trim() || '—',
    start_date: ruDate(data.startDate),
    end_date: ruDate(data.endDate),
    days_count: String(countInclusiveCalendarDays(data.startDate, data.endDate)),
    return_date: ruDate(addWorkingDaysIso(data.endDate, 1))
  };

  let xml = file.asText();
  for (const [key, value] of Object.entries(values)) {
    xml = xml.replaceAll(`{${key}}`, escapeXml(value));
  }
  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}

export { isLaborContractEmployee };

export const vacationApplicationFilename = (name: string, start: string): string =>
  `Заявление_на_отпуск_${name.replace(/[^\p{L}\p{N}\-_]+/gu, '_').replace(/_+/g, '_')}_${start}.docx`;
