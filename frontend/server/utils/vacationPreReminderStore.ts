import { join } from 'node:path';
import { vacationReminderLogRepo } from './vacationReminderLogsBackend';

export type VacationPreReminderKind = 'pre_3w';

export type VacationPreReminderRecord = {
  key: string;
  kind: VacationPreReminderKind;
  request_id: number;
  employee: string;
  bitrix_user_id: number;
  start: string;
  end: string;
  sent_at: string;
  channel: string;
  message_id?: number | string;
};

/** JSON-файл журнала (прод и локалка; на стейдже с DB_VACATIONS=1 — бэкап до этапа 5). */
export const VACATION_PRE_REMINDER_FILE = (): string =>
  String(process.env.VACATION_PRE_REMINDER_FILE || '').trim() ||
  join(process.cwd(), 'server/data/vacation-pre-reminders.json');

const repo = () => vacationReminderLogRepo<VacationPreReminderRecord>('pre', VACATION_PRE_REMINDER_FILE);

export const reminderKey = (
  kind: VacationPreReminderKind,
  requestId: number,
  start: string
): string => `${kind}:${requestId}:${start}`;

export const hasPreReminder = async (key: string): Promise<boolean> => (await repo()).has(key);

export const recordPreReminder = async (row: VacationPreReminderRecord): Promise<void> =>
  (await repo()).record(row, { reason: 'cron-pre-reminder' });
