import { requireVbiSession } from '../../utils/session';
import { sessionNotificationRecipientIds } from '../../utils/notificationRecipients';
import { markAllUserNotificationsSeen } from '../../utils/userNotificationsStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const recipients = await sessionNotificationRecipientIds(session);
  const changed = await markAllUserNotificationsSeen(recipients);
  return { ok: true, changed };
});
