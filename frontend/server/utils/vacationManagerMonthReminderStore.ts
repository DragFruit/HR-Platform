import { join } from 'node:path';
import { vacationReminderLogRepo } from './vacationReminderLogsBackend';

export type ManagerMonthReminderKind = 'mgr_next_month' | 'mgr_current_month';

export type ManagerMonthReminderRecord = {
  key: string;
  kind: ManagerMonthReminderKind;
  /** Месяц, о котором сообщили (YYYY-MM), не месяц отправки. */
  target_month: string;
  manager: string;
  bitrix_user_id: number;
  vacation_count: number;
  sent_at: string;
  channel: string;
  message_id?: number | string;
};

/** JSON-файл журнала (прод и локалка; на стейдже с DB_VACATIONS=1 — бэкап до этапа 5). */
export const VACATION_MANAGER_MONTH_REMINDER_FILE = (): string =>
  String(process.env.VACATION_MANAGER_MONTH_REMINDER_FILE || '').trim() ||
  join(process.cwd(), 'server/data/vacation-manager-month-reminders.json');

const repo = () =>
  vacationReminderLogRepo<ManagerMonthReminderRecord>('manager-month', VACATION_MANAGER_MONTH_REMINDER_FILE);

export const managerMonthReminderKey = (
  kind: ManagerMonthReminderKind,
  bitrixUserId: number,
  targetMonth: string
): string => `${kind}:${bitrixUserId}:${targetMonth}`;

export const hasManagerMonthReminder = async (key: string): Promise<boolean> => (await repo()).has(key);

export const recordManagerMonthReminder = async (row: ManagerMonthReminderRecord): Promise<void> =>
  (await repo()).record(row, { reason: 'cron-manager-month-reminder' });
