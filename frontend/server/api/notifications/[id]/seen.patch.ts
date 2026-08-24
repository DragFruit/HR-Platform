import { requireVbiSession } from '../../../utils/session';
import { sessionNotificationRecipientIds } from '../../../utils/notificationRecipients';
import { markUserNotificationSeen } from '../../../utils/userNotificationsStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Не указан id уведомления' });
  }

  const recipients = await sessionNotificationRecipientIds(session);
  const notification = await markUserNotificationSeen(recipients, id);
  if (!notification) {
    throw createError({ statusCode: 404, statusMessage: 'Уведомление не найдено' });
  }
  return { ok: true, notification };
});
