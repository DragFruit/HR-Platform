import { createError } from 'h3';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export const OPENAI_CODE_SENDER = 'noreply@tm.openai.com';
export const OPENAI_CODE_MARKER = 'Please use the following code to help verify your identity:';
const MAX_AGE_MS = 60 * 60 * 1000;

export type ChatgptMailCode = {
  code: string;
  receivedAt: string;
};

function readMailConfig() {
  const user = String(process.env.EMAIL_LOGIN || '').trim();
  const pass = String(process.env.EMAIL_PASSWORD || process.env.PASSWORD || '').trim();
  const host = String(process.env.EMAIL_IMAP_HOST || 'imap.gmail.com').trim();
  const port = Number(process.env.EMAIL_IMAP_PORT || 993) || 993;
  if (!user || !pass) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Почта для кодов ChatGPT не настроена (EMAIL_LOGIN / EMAIL_PASSWORD)'
    });
  }
  return { user, pass, host, port };
}

function extractCodeFromText(text: string): string | null {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const idx = normalized.toLowerCase().indexOf(OPENAI_CODE_MARKER.toLowerCase());
  if (idx < 0) return null;
  const after = normalized.slice(idx + OPENAI_CODE_MARKER.length);
  const m = after.match(/(\d{4,8})/);
  return m?.[1] ?? null;
}

/**
 * Коды за последний час, новые сверху. Дубликаты кода схлопываем (оставляем свежее).
 */
export async function listRecentOpenaiChatgptCodes(): Promise<ChatgptMailCode[]> {
  const { user, pass, host, port } = readMailConfig();
  const since = new Date(Date.now() - MAX_AGE_MS);
  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false
  });

  const found: ChatgptMailCode[] = [];
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Gmail: поиск по FROM + SINCE (день); час режем сами по internalDate
      const uids = await client.search({
        from: OPENAI_CODE_SENDER,
        since
      });
      if (!uids.length) return [];

      for await (const msg of client.fetch(uids, { source: true, envelope: true, internalDate: true })) {
        const received = msg.internalDate ? new Date(msg.internalDate) : null;
        if (!received || Number.isNaN(received.getTime())) continue;
        if (Date.now() - received.getTime() > MAX_AGE_MS) continue;

        const parsed = await simpleParser(msg.source!);
        const blob = [parsed.text || '', parsed.html ? String(parsed.html).replace(/<[^>]+>/g, ' ') : ''].join(
          '\n'
        );
        const subject = String(parsed.subject || msg.envelope?.subject || '');
        const code = extractCodeFromText(`${subject}\n${blob}`);
        if (!code) continue;
        found.push({ code, receivedAt: received.toISOString() });
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }

  found.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const seen = new Set<string>();
  const unique: ChatgptMailCode[] = [];
  for (const row of found) {
    if (seen.has(row.code)) continue;
    seen.add(row.code);
    unique.push(row);
  }
  return unique;
}

export type PickChatgptCodeResult =
  | { status: 'found'; code: string; receivedAt: string }
  | { status: 'none' }
  | { status: 'exhausted' };

/** Первый код не из exclude (уже отданные юзеру). */
export async function pickOpenaiChatgptCode(excludeCodes: string[]): Promise<PickChatgptCodeResult> {
  const exclude = new Set(excludeCodes.map((c) => String(c).trim()).filter(Boolean));
  const list = await listRecentOpenaiChatgptCodes();
  if (!list.length) return { status: 'none' };
  const next = list.find((row) => !exclude.has(row.code));
  if (!next) return { status: 'exhausted' };
  return { status: 'found', code: next.code, receivedAt: next.receivedAt };
}
