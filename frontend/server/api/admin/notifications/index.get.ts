import { requireRole } from '../../../utils/requireRole';
import {
  countUnseenAdminNotifications,
  listAdminNotifications
} from '../../../utils/adminNotificationsStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const query = getQuery(event);
  const unseen = query.unseen === 'true' || query.unseen === '1';
  const notifications = await listAdminNotifications({ unseen });
  const unseen_count = await countUnseenAdminNotifications();
  return { notifications, unseen_count };
});
