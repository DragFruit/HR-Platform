import { readFile } from 'node:fs/promises';
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

const FIELD_PAD = '\u2007';
const pad = (value: string, width: number) => {
  const t = value.trim();
  return t.length >= width ? `${t} ` : t + FIELD_PAD.repeat(width - t.length);
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

export async function buildVacationApplicationDocx(data: VacationApplicationData): Promise<Buffer> {
  const doc = new Docxtemplater(new PizZip(await readTemplate()), {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' }
  });
  doc.render({
    legal_entity: resolveLegalEntityFullName(data.legalEntity) || '—',
    employee_name: data.employeeName.trim() || '—',
    position: data.position.trim() || '—',
    vacation_type: 'ежегодный',
    start_date: pad(ruDate(data.startDate), 21),
    end_date: pad(ruDate(data.endDate), 23),
    days_count: pad(String(countInclusiveCalendarDays(data.startDate, data.endDate)), 10),
    return_date: ruDate(addWorkingDaysIso(data.endDate, 1))
  });
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export { isLaborContractEmployee };

export const vacationApplicationFilename = (name: string, start: string): string =>
  `Заявление_на_отпуск_${name.replace(/[^\p{L}\p{N}\-_]+/gu, '_').replace(/_+/g, '_')}_${start}.docx`;
