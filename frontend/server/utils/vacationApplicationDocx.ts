import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { isLaborContractEmployee } from '../../app/data/employeeDirectoryOptions';
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
  const label = date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return `${label} г.`;
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
    legal_entity: data.legalEntity.trim() || '—',
    from_line: buildFromLine(data.position, data.employeeName),
    employee_name: data.employeeName.trim() || '—',
    position: data.position.trim() || '—',
    start_date: formatRuDate(data.startDate),
    end_date: formatRuDate(data.endDate),
    days_count: String(days),
    return_date: formatRuDate(returnIso)
  };
};

const buildFromTemplateFile = async (data: VacationApplicationData): Promise<Buffer> => {
  const templateBytes = await readFile(VACATION_APPLICATION_TEMPLATE_PATH);
  const zip = new PizZip(templateBytes);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' }
  });

  doc.render(buildTemplatePayload(data));

  return doc.getZip().generate({ type: 'nodebuffer' });
};

export async function buildVacationApplicationDocx(data: VacationApplicationData): Promise<Buffer> {
  try {
    await access(VACATION_APPLICATION_TEMPLATE_PATH);
  } catch {
    throw new Error(
      'Шаблон заявления не найден: server/templates/vacation-application.docx. ' +
        'Запустите node scripts/prepare-vacation-application-template.mjs'
    );
  }

  return buildFromTemplateFile(data);
}

export { isLaborContractEmployee };

export const vacationApplicationFilename = (employeeName: string, startDate: string): string => {
  const safeName = employeeName.replace(/[^\p{L}\p{N}\-_]+/gu, '_').replace(/_+/g, '_');
  return `Заявление_на_отпуск_${safeName}_${startDate}.docx`;
};
