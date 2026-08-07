import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { writeJsonAtomic } from './atomicJson';
import { dirname, join } from 'node:path';

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

type StoreState = {
  version: 1;
  sent: VacationPreReminderRecord[];
};

const STORE_PATH = (): string =>
  String(process.env.VACATION_PRE_REMINDER_FILE || '').trim() ||
  join(process.cwd(), 'server/data/vacation-pre-reminders.json');

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

export const reminderKey = (
  kind: VacationPreReminderKind,
  requestId: number,
  start: string
): string => `${kind}:${requestId}:${start}`;

export const hasPreReminder = async (key: string): Promise<boolean> => {
  const state = await readStore();
  return state.sent.some((row) => row.key === key);
};

export const recordPreReminder = async (
  row: VacationPreReminderRecord
): Promise<void> => {
  writeChain = writeChain.then(async () => {
    const state = await readStore();
    if (state.sent.some((item) => item.key === row.key)) return;
    state.sent.push(row);
    await writeStore(state);
  });
  await writeChain;
};
