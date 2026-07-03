import { requireRole } from '../../../../utils/requireRole';
import { markAdminNotificationSeen } from '../../../../utils/adminNotificationsStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Не указан id уведомления' });
  }
  const notification = await markAdminNotificationSeen(id);
  if (!notification) {
    throw createError({ statusCode: 404, statusMessage: 'Уведомление не найдено' });
  }
  return { ok: true, notification };
});
