import { requireVbiSession } from '../../../utils/session';
import { dismissUserNotification } from '../../../utils/userNotificationsStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Не указан id уведомления' });
  }

  const removed = await dismissUserNotification(session.id, id);
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: 'Уведомление не найдено' });
  }
  return { ok: true };
});
