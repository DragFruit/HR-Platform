import { getVbiSession } from '../../utils/session';
import { createTenureGiftOrderNotification } from '../../utils/adminNotificationsStore';

export default defineEventHandler(async (event) => {
  const session = getVbiSession(event);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Нужна авторизация' });
  }

  const body = await readBody<{
    employee_id?: number;
    employee_name?: string;
    years?: number;
    sku?: string;
    order_id?: string;
  }>(event);

  const employeeId = Number(body?.employee_id);
  const years = Number(body?.years);
  const sku = String(body?.sku || '').trim();
  const orderId = String(body?.order_id || '').trim();
  const employeeName = String(body?.employee_name || session.name || '').trim();

  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный employee_id' });
  }
  if (![5, 10, 15].includes(years)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный юбилей' });
  }
  if (!sku || !orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Нужны sku и order_id' });
  }

  const notification = await createTenureGiftOrderNotification({
    employee_id: employeeId,
    employee_name: employeeName || session.name,
    years,
    sku,
    order_id: orderId
  });

  return { ok: true, notification };
});
