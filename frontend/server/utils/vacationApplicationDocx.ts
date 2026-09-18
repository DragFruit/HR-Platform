import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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

/** Шаблон лежит рядом с сервером (не в server/assets — иначе Nitro жрёт RAM на CI). */
async function readTemplate(): Promise<Buffer> {
  const candidates = [
    join(process.cwd(), 'templates/vacation-application.docx'),
    join(process.cwd(), 'server/templates/vacation-application.docx')
  ];
  for (const path of candidates) {
    try {
      return await readFile(path);
    } catch {
      /* try next */
    }
  }
  throw new Error('Шаблон заявления не найден (templates/vacation-application.docx)');
}

export async function buildVacationApplicationDocx(data: VacationApplicationData): Promise<Buffer> {
  // Динамический import — pizzip не в графе Vite SSR на этапе transform.
  const { default: PizZip } = await import('pizzip');
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
