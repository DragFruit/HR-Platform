import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createMutationQueue, writeJsonAtomic } from './atomicJson';

export type ChatgptCodeTelegramSent = {
  code: string;
  receivedAt: string;
  sentAt: string;
  messageId?: number;
};

type StoreState = {
  version: 1;
  /** Коды, уже отправленные в Telegram (дедуп). */
  sent: ChatgptCodeTelegramSent[];
};

const STORE_PATH = (): string =>
  String(process.env.CHATGPT_CODE_TELEGRAM_STATE_FILE || '').trim() ||
  join(process.cwd(), 'server/data/chatgpt-code-telegram-state.json');

const empty = (): StoreState => ({ version: 1, sent: [] });

const enqueue = createMutationQueue();

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

/** Оставляем записи за последние 7 дней — хватает для дедупа при окне свежести 1 ч. */
function pruneOld(sent: ChatgptCodeTelegramSent[]): ChatgptCodeTelegramSent[] {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return sent.filter((row) => {
    const t = Date.parse(row.sentAt);
    return Number.isFinite(t) && t >= cutoff;
  });
}

export async function listSentChatgptCodes(): Promise<Set<string>> {
  const state = await readStore();
  return new Set(state.sent.map((r) => r.code));
}

export async function recordSentChatgptCode(
  row: ChatgptCodeTelegramSent
): Promise<void> {
  await enqueue(async () => {
    const state = await readStore();
    if (state.sent.some((item) => item.code === row.code)) return;
    state.sent = pruneOld([...state.sent, row]);
    await writeStore(state);
  });
}
