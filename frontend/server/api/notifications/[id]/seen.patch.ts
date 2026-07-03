import { requireVbiSession } from '../../../utils/session';
import { markUserNotificationSeen } from '../../../utils/userNotificationsStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Не указан id уведомления' });
  }

  const notification = await markUserNotificationSeen(session.id, id);
  if (!notification) {
    throw createError({ statusCode: 404, statusMessage: 'Уведомление не найдено' });
  }
  return { ok: true, notification };
});
