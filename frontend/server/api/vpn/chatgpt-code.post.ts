import { requireVbiSession } from '../../utils/session';
import {
  CHATGPT_CODE_VPN_MAX_AGE_MS,
  formatChatgptCodeListMessage,
  listRecentOpenaiChatgptCodes
} from '../../utils/openaiChatgptMailCode';

/**
 * Коды ChatGPT с корпоративной почты за последние 15 минут.
 * Ответ — список с временем прихода по МСК.
 */
export default defineEventHandler(async (event) => {
  await requireVbiSession(event);

  try {
    const codes = await listRecentOpenaiChatgptCodes(CHATGPT_CODE_VPN_MAX_AGE_MS);

    if (!codes.length) {
      return {
        ok: true,
        status: 'none' as const,
        codes: [],
        message: 'Код не пришёл'
      };
    }

    return {
      ok: true,
      status: 'found' as const,
      codes: codes.map((row) => ({
        code: row.code,
        receivedAt: row.receivedAt
      })),
      message: formatChatgptCodeListMessage(codes)
    };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[chatgpt-code] mail fetch failed:', msg);
    throw createError({
      statusCode: 502,
      statusMessage: 'Не удалось проверить почту. Попробуйте ещё раз чуть позже.'
    });
  }
});
