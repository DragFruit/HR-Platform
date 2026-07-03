import { requireRole } from '../../../utils/requireRole';
import { markAllAdminNotificationsSeen } from '../../../utils/adminNotificationsStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const changed = await markAllAdminNotificationsSeen();
  return { ok: true, changed };
});
