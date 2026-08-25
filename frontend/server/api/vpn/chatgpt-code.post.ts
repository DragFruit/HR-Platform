import { requireVbiSession } from '../../utils/session';
import { pickOpenaiChatgptCode } from '../../utils/openaiChatgptMailCode';

type Body = {
  /** Коды, которые уже отдали этому пользователю (стек: следующий = более старый). */
  excludeCodes?: string[];
};

/**
 * Свежий код ChatGPT с корпоративной почты (за последний час).
 * Повтор с excludeCodes → предыдущий код; иначе «больше не приходило».
 */
export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  const body = ((await readBody(event)) || {}) as Body;
  const excludeCodes = Array.isArray(body.excludeCodes)
    ? body.excludeCodes.map((c) => String(c || '').trim()).filter(Boolean).slice(0, 20)
    : [];

  try {
    const result = await pickOpenaiChatgptCode(excludeCodes);

    if (result.status === 'found') {
      return {
        ok: true,
        status: 'found' as const,
        code: result.code,
        receivedAt: result.receivedAt,
        message: `Код ChatGPT: ${result.code}`
      };
    }

    if (result.status === 'exhausted') {
      return {
        ok: true,
        status: 'exhausted' as const,
        code: null,
        message: 'Больше кодов не приходило'
      };
    }

    return {
      ok: true,
      status: 'none' as const,
      code: null,
      message: 'Код не пришёл'
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
