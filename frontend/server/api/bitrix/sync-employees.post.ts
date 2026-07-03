import { syncEmployeesFromBitrix } from '../../utils/bitrixSync';
import { requireRole } from '../../utils/requireRole';

function errorStatusMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'statusMessage' in err) {
    return String((err as { statusMessage?: string }).statusMessage || '');
  }
  return err instanceof Error ? err.message : String(err);
}

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);

  try {
    const result = await syncEmployeesFromBitrix(undefined, { importNew: true });
    return { ok: true, ...result };
  } catch (err) {
    const message = errorStatusMessage(err);
    const needsOAuth =
      message.includes('Нет OAuth-токена') ||
      message.toLowerCase().includes('invalid_credentials') ||
      message.toLowerCase().includes('invalid request credentials');

    if (needsOAuth) {
      throw createError({
        statusCode: 503,
        statusMessage:
          'Синхронизация через API недоступна: вебхук Bitrix невалиден или не задан. ' +
          'Обновите BITRIX_WEBHOOK_URL на сервере или войдите через Bitrix — при входе синк использует OAuth-токен.'
      });
    }
    throw err;
  }
});
