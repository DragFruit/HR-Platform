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
  countVacationBillableDays,
  trimVacationHolidayEdges
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

/**
 * Период для заявления: праздники на краях в отпуск не входят. Новые заявки уже сохранены
 * обрезанными; для старых (край на празднике) обрезаем здесь же, данные заявки не трогаем.
 */
export const vacationApplicationPeriod = (
  startIso: string,
  endIso: string
): { start: string; end: string; days: number } => {
  const trimmed = trimVacationHolidayEdges(startIso, endIso);
  const start = trimmed.empty ? startIso : trimmed.start;
  const end = trimmed.empty ? endIso : trimmed.end;
  return { start, end, days: countVacationBillableDays(start, end) };
};

/** Значения плейсхолдеров бланка (без файла — удобно для тестов). */
export const vacationApplicationValues = (data: VacationApplicationData): Record<string, string> => {
  const period = vacationApplicationPeriod(data.startDate, data.endDate);
  return {
    legal_entity: resolveLegalEntityFullName(data.legalEntity) || '—',
    employee_name: data.employeeName.trim() || '—',
    position: data.position.trim() || '—',
    start_date: ruDate(period.start),
    end_date: ruDate(period.end),
    // Дни в счёт отпуска: календарные без праздников (как в балансе), а не календарная разница.
    days_count: String(period.days),
    return_date: ruDate(addWorkingDaysIso(period.end, 1))
  };
};

/** Без npm-zip: системные unzip/zip (на VPS есть). Не тянем pizzip в Nitro CI. */
export async function buildVacationApplicationDocx(data: VacationApplicationData): Promise<Buffer> {
  const values = vacationApplicationValues(data);

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
