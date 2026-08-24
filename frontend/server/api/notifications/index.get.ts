import { requireVbiSession } from '../../utils/session';
import { sessionNotificationRecipientIds } from '../../utils/notificationRecipients';
import {
  countUnseenUserNotifications,
  listUserNotifications
} from '../../utils/userNotificationsStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const query = getQuery(event);
  const unseen = query.unseen === '1' || query.unseen === 'true';
  const recipients = await sessionNotificationRecipientIds(session);

  const notifications = await listUserNotifications(recipients, { unseen });
  const unseen_count = await countUnseenUserNotifications(recipients);
  return { notifications, unseen_count };
});
