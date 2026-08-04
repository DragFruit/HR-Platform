import type { VacationRequest } from '../../app/composables/useVacations';
import { findEmployeeByName, readEmployees } from './employeesStore';
import { sendBitrixImbotMessage, isBitrixImbotConfigured } from './bitrixImbot';
import {
  hasPreReminder,
  recordPreReminder,
  reminderKey,
  type VacationPreReminderKind
} from './vacationPreReminderStore';
import { readVacations } from './vacationsStore';

/** Ровно 3 недели = 21 календарный день до даты начала (03.08 → старт 24.08). */
const PRE_3W_DAYS = 21;

const KIND: VacationPreReminderKind = 'pre_3w';

const formatDateRu = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

/** Календарные дни от today (локальная дата сервера) до start ISO. */
export const calendarDaysUntil = (startIso: string, today = new Date()): number => {
  const [y, m, d] = startIso.split('-').map(Number);
  if (!y || !m || !d) return Number.NaN;
  const start = new Date(y, m - 1, d);
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((start.getTime() - from.getTime()) / 86_400_000);
};

/** Памятки по отделам (Bitrix Disk). Остальным отделам блок не добавляем. */
const VACATION_MEMO_BY_DEPARTMENT: Array<{ match: (department: string) => boolean; url: string }> = [
  {
    // SEO / SERM / ORM (в справочнике: «SEO / ORM»)
    match: (d) => {
      const n = d.toLowerCase();
      return n.includes('seo') || n.includes('serm') || n.includes('orm');
    },
    url: 'https://crm.vbi.ru/devs/24611/'
  },
  {
    match: (d) => d.trim().toLowerCase() === 'digital' || d.toLowerCase().startsWith('digital '),
    url: 'https://crm.vbi.ru/devs/21301/'
  }
];

export const vacationMemoUrlForDepartment = (department: string | null | undefined): string | null => {
  const raw = String(department || '').trim();
  if (!raw) return null;
  for (const rule of VACATION_MEMO_BY_DEPARTMENT) {
    if (rule.match(raw)) return rule.url;
  }
  return null;
};

export const buildPreVacationReminderMessage = (
  request: VacationRequest,
  options?: { department?: string | null }
): string => {
  const dates = `${formatDateRu(request.start)} — ${formatDateRu(request.end)}`;
  const lines = [
    `До отпуска осталось 3 недели (${dates}).`,
    '',
    'Пожалуйста, заранее:',
    '1. Напишите заявление на отпуск.',
    '2. Поставьте задачи на передачу проектов на время отпуска.'
  ];

  const memoUrl = vacationMemoUrlForDepartment(options?.department);
  if (memoUrl) {
    lines.push('', 'Памятка, как правильно уйти в отпуск:', `[URL=${memoUrl}]${memoUrl}[/URL]`);
  }

  return lines.join('\n');
};

export type PreReminderRunResult = {
  checked: number;
  due: number;
  sent: number;
  skipped: number;
  errors: Array<{ request_id: number; employee: string; error: string }>;
  dry_run: boolean;
  bot_configured: boolean;
};

const isDuePre3w = (daysUntil: number): boolean =>
  Number.isFinite(daysUntil) && daysUntil === PRE_3W_DAYS;

/**
 * Ежедневный прогон: approved-отпуска со стартом ровно через 21 день → сообщение от чат-бота.
 */
export async function runVacationPreReminders(options?: {
  dryRun?: boolean;
  today?: Date;
}): Promise<PreReminderRunResult> {
  const dryRun = Boolean(options?.dryRun);
  const today = options?.today ?? new Date();
  const botConfigured = isBitrixImbotConfigured();

  await readEmployees();
  const vacations = await readVacations();
  const requests = Object.values(vacations.requestsByYear).flat();

  const result: PreReminderRunResult = {
    checked: 0,
    due: 0,
    sent: 0,
    skipped: 0,
    errors: [],
    dry_run: dryRun,
    bot_configured: botConfigured
  };

  for (const request of requests) {
    if (request.status !== 'approved') continue;
    result.checked += 1;

    const daysUntil = calendarDaysUntil(request.start, today);
    if (!isDuePre3w(daysUntil)) continue;
    result.due += 1;

    const key = reminderKey(KIND, request.id, request.start);
    if (await hasPreReminder(key)) {
      result.skipped += 1;
      continue;
    }

    const employee = await findEmployeeByName(request.employee);
    const bitrixUserId = employee?.bitrix_user_id ?? null;
    if (!bitrixUserId) {
      result.errors.push({
        request_id: request.id,
        employee: request.employee,
        error: 'нет bitrix_user_id'
      });
      continue;
    }

    if (dryRun) {
      result.sent += 1;
      continue;
    }

    if (!botConfigured) {
      result.errors.push({
        request_id: request.id,
        employee: request.employee,
        error: 'BITRIX_IMBOT_ID не задан'
      });
      continue;
    }

    try {
      const message = buildPreVacationReminderMessage(request, {
        department: employee?.department
      });
      const { messageId, channel } = await sendBitrixImbotMessage({
        bitrixUserId,
        message
      });
      await recordPreReminder({
        key,
        kind: KIND,
        request_id: request.id,
        employee: request.employee,
        bitrix_user_id: bitrixUserId,
        start: request.start,
        end: request.end,
        sent_at: new Date().toISOString(),
        channel,
        message_id: messageId
      });
      result.sent += 1;
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'statusMessage' in err
          ? String((err as { statusMessage?: string }).statusMessage || '')
          : err instanceof Error
            ? err.message
            : String(err);
      result.errors.push({
        request_id: request.id,
        employee: request.employee,
        error: message
      });
    }
  }

  return result;
}
