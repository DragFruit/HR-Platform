import { requireVbiSession } from '../../utils/session';
import { sessionNotificationRecipientIds } from '../../utils/notificationRecipients';
import {
  createUserNotification,
  listUserNotifications
} from '../../utils/userNotificationsStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ vacation_request_id?: number }>(event);
  const requestId = Number(body?.vacation_request_id);
  if (!Number.isFinite(requestId) || requestId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен vacation_request_id' });
  }

  const recipients = await sessionNotificationRecipientIds(session);
  const existing = (await listUserNotifications(recipients)).find(
    (item) => item.kind === 'post_vacation_memo' && item.vacation_request_id === requestId
  );
  if (existing) {
    return { ok: true, notification: existing, existed: true };
  }

  const notification = await createUserNotification({
    kind: 'post_vacation_memo',
    recipient_user_id: session.id,
    vacation_request_id: requestId,
    employee_name: session.name
  });
  return { ok: true, notification, existed: false };
});
