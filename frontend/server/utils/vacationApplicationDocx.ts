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
  splitVacationByHolidays,
  trimVacationHolidayEdges,
  type VacationSegment
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

/**
 * Отрезки для заявлений: праздник внутри отпуска делит его на части, по каждой своё заявление.
 * Весь период из праздников (старые данные) — одна страница по исходным датам.
 */
export const vacationApplicationSegments = (startIso: string, endIso: string): VacationSegment[] => {
  const period = vacationApplicationPeriod(startIso, endIso);
  const segments = splitVacationByHolidays(period.start, period.end);
  return segments.length ? segments : [{ start: period.start, end: period.end }];
};

/** Значения плейсхолдеров одной страницы (одного отрезка). */
const segmentValues = (data: VacationApplicationData, segment: VacationSegment): Record<string, string> => ({
  legal_entity: resolveLegalEntityFullName(data.legalEntity) || '—',
  employee_name: data.employeeName.trim() || '—',
  position: data.position.trim() || '—',
  start_date: ruDate(segment.start),
  end_date: ruDate(segment.end),
  // Дни в счёт отпуска: календарные без праздников (как в балансе), а не календарная разница.
  days_count: String(countVacationBillableDays(segment.start, segment.end)),
  // Выход: первый рабочий день после отрезка.
  return_date: ruDate(addWorkingDaysIso(segment.end, 1))
});

/** Значения плейсхолдеров по страницам: одна страница на каждый отрезок без праздников. */
export const vacationApplicationPages = (data: VacationApplicationData): Record<string, string>[] =>
  vacationApplicationSegments(data.startDate, data.endDate).map((segment) => segmentValues(data, segment));

const PAGE_BREAK_XML = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/**
 * document.xml с телом бланка, повторённым для каждой страницы через разрыв страницы.
 * Повторяется всё содержимое <w:body> до финального <w:sectPr> (поля страницы одни на документ).
 * В копиях убираем w14:paraId/textId, чтобы id абзацев не дублировались.
 */
export const renderVacationApplicationXml = (xml: string, pages: Record<string, string>[]): string => {
  const fill = (part: string, values: Record<string, string>) => {
    let out = part;
    for (const [key, value] of Object.entries(values)) out = out.replaceAll(`{${key}}`, escapeXml(value));
    return out;
  };
  const bodyOpen = xml.indexOf('<w:body>');
  const sectPr = xml.lastIndexOf('<w:sectPr');
  if (bodyOpen === -1 || sectPr === -1 || sectPr < bodyOpen || pages.length <= 1) {
    return fill(xml, pages[0] ?? {});
  }
  const head = xml.slice(0, bodyOpen + '<w:body>'.length);
  const body = xml.slice(bodyOpen + '<w:body>'.length, sectPr);
  const tail = xml.slice(sectPr);
  const copies = pages.map((values, index) => {
    const part = index === 0 ? body : body.replace(/\s+w14:(?:paraId|textId)="[^"]*"/g, '');
    return fill(part, values);
  });
  return head + copies.join(PAGE_BREAK_XML) + tail;
};

/** Без npm-zip: системные unzip/zip (на VPS есть). Не тянем pizzip в Nitro CI. */
export async function buildVacationApplicationDocx(data: VacationApplicationData): Promise<Buffer> {
  const pages = vacationApplicationPages(data);

  const root = await mkdtemp(join(tmpdir(), 'vbi-vac-app-'));
  const extract = join(root, 'extract');
  const outDocx = join(root, 'out.docx');
  try {
    await mkdir(extract);
    await execFileAsync('unzip', ['-q', await templatePath(), '-d', extract]);
    const xmlPath = join(extract, 'word/document.xml');
    const xml = renderVacationApplicationXml(await readFile(xmlPath, 'utf8'), pages);
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
