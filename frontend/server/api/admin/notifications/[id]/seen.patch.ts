import { requireRole } from '../../../../utils/requireRole';
import { markAdminNotificationSeen } from '../../../../utils/adminNotificationsStore';
import { sessionActorEmployeeId } from '../../../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin', 'hr']);
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Не указан id уведомления' });
  }
  const notification = await markAdminNotificationSeen(id, {
    actorEmployeeId: await sessionActorEmployeeId(session)
  });
  if (!notification) {
    throw createError({ statusCode: 404, statusMessage: 'Уведомление не найдено' });
  }
  return { ok: true, notification };
});
