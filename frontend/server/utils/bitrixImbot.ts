import { bitrixRest, bitrixWebhookRest } from './bitrixClient';
import { getBitrixServiceAccessToken } from './bitrixOAuthServiceToken';
import { isBitrixWebhookConfigured } from './bitrixConfig';
import { assertBitrixWriteAllowed } from './bitrixWriteGuard';

/**
 * Отправка личного сообщения от чат-бота Bitrix.
 * Классический API: imbot.message.add (коробка crm.vbi.ru).
 * @see https://apidocs.bitrix24.ru/api-reference/chat-bots/messages/imbot-message-add.html
 */

const botIdFromEnv = (): number | null => {
  const n = Number(process.env.BITRIX_IMBOT_ID || '');
  return Number.isFinite(n) && n > 0 ? n : null;
};

const clientIdFromEnv = (): string =>
  String(process.env.BITRIX_CLIENT_ID || process.env.BITRIX_IMBOT_CLIENT_ID || '').trim();

export const isBitrixImbotConfigured = (): boolean => Boolean(botIdFromEnv());

const errorMessage = (err: unknown): string => {
  if (err && typeof err === 'object' && 'statusMessage' in err) {
    return String((err as { statusMessage?: string }).statusMessage || '');
  }
  return err instanceof Error ? err.message : String(err);
};

/**
 * Пишет сотруднику в личный чат от имени бота (DIALOG_ID = bitrix user id).
 */
export async function sendBitrixImbotMessage(params: {
  bitrixUserId: number;
  message: string;
}): Promise<{ messageId: number | string; channel: string }> {
  // Стейдж/локалка: одна строка в лог и BitrixWriteBlockedError (без OAuth→webhook фолбэка).
  assertBitrixWriteAllowed('imbot.message.add');
  const botId = botIdFromEnv();
  if (!botId) {
    throw new Error(
      'BITRIX_IMBOT_ID не задан — зарегистрируйте чат-бота в Битриксе (см. docs/BITRIX.md)'
    );
  }

  const clientId = clientIdFromEnv();
  const body: Record<string, unknown> = {
    BOT_ID: botId,
    DIALOG_ID: String(params.bitrixUserId),
    MESSAGE: params.message
  };
  if (clientId) body.CLIENT_ID = clientId;

  const accessToken = await getBitrixServiceAccessToken();
  if (accessToken) {
    try {
      const result = await bitrixRest<number | string>('imbot.message.add', body, accessToken);
      return { messageId: result, channel: 'imbot.message.add:oauth' };
    } catch (err) {
      const message = errorMessage(err);
      if (!isBitrixWebhookConfigured()) throw err;
      console.warn('[bitrix-imbot] OAuth failed, trying webhook:', message);
    }
  }

  if (!isBitrixWebhookConfigured()) {
    throw new Error(
      'Нет OAuth service token и вебхука для imbot.message.add — войдите через Битрикс или расширьте права вебхука (imbot)'
    );
  }

  try {
    const result = await bitrixWebhookRest<number | string>('imbot.message.add', body);
    return { messageId: result, channel: 'imbot.message.add:webhook' };
  } catch (err) {
    throw new Error(
      `imbot.message.add: ${errorMessage(err)}. ` +
        'Нужны: чат-бот (BITRIX_IMBOT_ID), право imbot у OAuth-приложения или вебхука.'
    );
  }
}
