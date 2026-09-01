import { createError } from 'h3';

/**
 * Минимальный клиент Telegram Bot API (sendMessage).
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID | TELEGRAM_CHANNEL_ID
 */

export type TelegramSendResult = {
  ok: true;
  messageId: number;
};

function readTelegramConfig() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(
    process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHANNEL_ID || ''
  ).trim();
  if (!token) {
    throw createError({
      statusCode: 503,
      statusMessage: 'TELEGRAM_BOT_TOKEN не задан'
    });
  }
  if (!chatId) {
    throw createError({
      statusCode: 503,
      statusMessage: 'TELEGRAM_CHAT_ID (или TELEGRAM_CHANNEL_ID) не задан'
    });
  }
  return { token, chatId };
}

export async function sendTelegramMessage(text: string): Promise<TelegramSendResult> {
  const { token, chatId } = readTelegramConfig();

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  } | null;

  if (!res.ok || !body?.ok) {
    const detail = body?.description || `HTTP ${res.status}`;
    throw createError({
      statusCode: 502,
      statusMessage: `Telegram sendMessage: ${detail}`
    });
  }

  return { ok: true, messageId: Number(body.result?.message_id) || 0 };
}
