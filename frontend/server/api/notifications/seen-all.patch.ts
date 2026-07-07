import { requireVbiSession } from '../../utils/session';
import { markAllUserNotificationsSeen } from '../../utils/userNotificationsStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const changed = await markAllUserNotificationsSeen(session.id);
  return { ok: true, changed };
});
