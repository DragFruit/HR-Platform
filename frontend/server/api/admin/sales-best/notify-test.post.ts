import { requireRole } from '../../../utils/requireRole';
import { runSalesBestPickDue } from '../../../utils/salesBestPickDue';

/** Тест / ручной триггер: создать уведомление «как в 29-е». */
export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const body = await readBody<{ period?: string }>(event).catch(() => ({}));
  const result = await runSalesBestPickDue({
    force: true,
    period: body?.period ? String(body.period) : undefined
  });
  return { ok: true, ...result };
});
