import { requireVbiSession } from '../../utils/session';
import {
  countUnseenUserNotifications,
  listUserNotifications
} from '../../utils/userNotificationsStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const query = getQuery(event);
  const unseen = query.unseen === '1' || query.unseen === 'true';

  const notifications = await listUserNotifications(session.id, { unseen });
  const unseen_count = await countUnseenUserNotifications(session.id);
  return { notifications, unseen_count };
});
