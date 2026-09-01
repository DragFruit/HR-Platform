import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { writeJsonAtomic } from './atomicJson';
import { dirname, join } from 'node:path';

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

type StoreState = {
  version: 1;
  sent: ManagerMonthReminderRecord[];
};

const STORE_PATH = (): string =>
  String(process.env.VACATION_MANAGER_MONTH_REMINDER_FILE || '').trim() ||
  join(process.cwd(), 'server/data/vacation-manager-month-reminders.json');

const empty = (): StoreState => ({ version: 1, sent: [] });

let writeChain: Promise<void> = Promise.resolve();

const readStore = async (): Promise<StoreState> => {
  const path = STORE_PATH();
  if (!existsSync(path)) return empty();
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as StoreState;
    if (!raw || raw.version !== 1 || !Array.isArray(raw.sent)) return empty();
    return raw;
  } catch {
    return empty();
  }
};

const writeStore = async (state: StoreState): Promise<void> => {
  const path = STORE_PATH();
  await mkdir(dirname(path), { recursive: true });
  await writeJsonAtomic(path, state);
};

export const managerMonthReminderKey = (
  kind: ManagerMonthReminderKind,
  bitrixUserId: number,
  targetMonth: string
): string => `${kind}:${bitrixUserId}:${targetMonth}`;

export const hasManagerMonthReminder = async (key: string): Promise<boolean> => {
  const state = await readStore();
  return state.sent.some((row) => row.key === key);
};

export const recordManagerMonthReminder = async (
  row: ManagerMonthReminderRecord
): Promise<void> => {
  writeChain = writeChain.then(async () => {
    const state = await readStore();
    if (state.sent.some((item) => item.key === row.key)) return;
    state.sent.push(row);
    await writeStore(state);
  });
  await writeChain;
};
