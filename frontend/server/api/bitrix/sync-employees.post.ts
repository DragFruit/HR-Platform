import { syncEmployeesFromBitrix } from '../../utils/bitrixSync';
import { isBitrixWebhookConfigured } from '../../utils/bitrixConfig';
import { requireRole } from '../../utils/requireRole';

export default defineEventHandler(async (event) => {
  requireRole(event, ['admin', 'hr']);

  if (!isBitrixWebhookConfigured()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Задайте BITRIX_WEBHOOK_URL на сервере для синхронизации сотрудников'
    });
  }

  const result = await syncEmployeesFromBitrix();
  return { ok: true, ...result };
});
