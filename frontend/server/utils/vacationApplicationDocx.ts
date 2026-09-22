import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  isLaborContractEmployee,
  resolveLegalEntityFullName
} from '../../app/data/employeeDirectoryOptions';
import {
  addWorkingDaysIso,
  countInclusiveCalendarDays
} from '../../app/utils/vacationCalendar';

const execFileAsync = promisify(execFile);

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

async function templatePath(): Promise<string> {
  const candidates = [
    join(process.cwd(), 'templates/vacation-application.docx'),
    join(process.cwd(), 'server/templates/vacation-application.docx'),
    // CI кладёт бланк в .output; cwd сервиса — корень стенда (/var/www/vbi-hr)
    join(process.cwd(), '.output/server/templates/vacation-application.docx')
  ];
  for (const path of candidates) {
    try {
      await readFile(path);
      return path;
    } catch {
      /* next */
    }
  }
  throw new Error('Шаблон заявления не найден (templates/vacation-application.docx)');
}

/** Без npm-zip: системные unzip/zip (на VPS есть). Не тянем pizzip в Nitro CI. */
export async function buildVacationApplicationDocx(data: VacationApplicationData): Promise<Buffer> {
  const values: Record<string, string> = {
    legal_entity: resolveLegalEntityFullName(data.legalEntity) || '—',
    employee_name: data.employeeName.trim() || '—',
    position: data.position.trim() || '—',
    start_date: ruDate(data.startDate),
    end_date: ruDate(data.endDate),
    days_count: String(countInclusiveCalendarDays(data.startDate, data.endDate)),
    return_date: ruDate(addWorkingDaysIso(data.endDate, 1))
  };

  const root = await mkdtemp(join(tmpdir(), 'vbi-vac-app-'));
  const extract = join(root, 'extract');
  const outDocx = join(root, 'out.docx');
  try {
    await mkdir(extract);
    await execFileAsync('unzip', ['-q', await templatePath(), '-d', extract]);
    const xmlPath = join(extract, 'word/document.xml');
    let xml = await readFile(xmlPath, 'utf8');
    for (const [key, value] of Object.entries(values)) {
      xml = xml.replaceAll(`{${key}}`, escapeXml(value));
    }
    await writeFile(xmlPath, xml, 'utf8');
    await execFileAsync('zip', ['-qr', outDocx, '.'], { cwd: extract });
    return await readFile(outDocx);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export { isLaborContractEmployee };

export const vacationApplicationFilename = (name: string, start: string): string =>
  `Заявление_на_отпуск_${name.replace(/[^\p{L}\p{N}\-_]+/gu, '_').replace(/_+/g, '_')}_${start}.docx`;
