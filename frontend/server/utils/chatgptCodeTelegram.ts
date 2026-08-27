import { listRecentOpenaiChatgptCodes } from './openaiChatgptMailCode';
import { sendTelegramMessage } from './telegramBot';
import {
  listSentChatgptCodes,
  recordSentChatgptCode
} from './chatgptCodeTelegramState';

export type ChatgptCodeTelegramSyncResult = {
  checkedAt: string;
  /** Сколько кодов нашлось в почте за окно свежести (~1 ч). */
  foundInMail: number;
  /** Уже были в state — не слали. */
  skippedDup: number;
  /** Отправлено (или dry_run). */
  posted: Array<{ code: string; receivedAt: string; messageId?: number; dryRun?: boolean }>;
  errors: string[];
};

/**
 * IMAP → новые коды ChatGPT (окно ~1 ч) → Telegram-канал.
 * Дедуп по коду в server/data/chatgpt-code-telegram-state.json.
 */
export async function runChatgptCodeTelegramSync(opts: {
  dryRun?: boolean;
} = {}): Promise<ChatgptCodeTelegramSyncResult> {
  const result: ChatgptCodeTelegramSyncResult = {
    checkedAt: new Date().toISOString(),
    foundInMail: 0,
    skippedDup: 0,
    posted: [],
    errors: []
  };

  const list = await listRecentOpenaiChatgptCodes();
  result.foundInMail = list.length;
  if (!list.length) return result;

  const already = await listSentChatgptCodes();
  // Новые сверху в list; шлём от старых к новым, чтобы в чате порядок был хронологический.
  const fresh = list.filter((row) => !already.has(row.code)).reverse();
  result.skippedDup = list.length - fresh.length;

  for (const row of fresh) {
    if (opts.dryRun) {
      result.posted.push({ code: row.code, receivedAt: row.receivedAt, dryRun: true });
      continue;
    }
    const text = `Кто просил код от chatGPT?\n${row.code}`;
    try {
      const sent = await sendTelegramMessage(text);
      await recordSentChatgptCode({
        code: row.code,
        receivedAt: row.receivedAt,
        sentAt: new Date().toISOString(),
        messageId: sent.messageId
      });
      result.posted.push({
        code: row.code,
        receivedAt: row.receivedAt,
        messageId: sent.messageId
      });
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'statusMessage' in e
          ? String((e as { statusMessage?: string }).statusMessage || '')
          : e instanceof Error
            ? e.message
            : String(e);
      result.errors.push(`${row.code}: ${msg || 'unknown error'}`);
    }
  }

  return result;
}
