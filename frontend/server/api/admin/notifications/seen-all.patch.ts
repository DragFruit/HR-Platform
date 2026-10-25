import { requireRole } from '../../../utils/requireRole';
import { markAllAdminNotificationsSeen } from '../../../utils/adminNotificationsStore';
import { sessionActorEmployeeId } from '../../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin', 'hr']);
  const changed = await markAllAdminNotificationsSeen({
    actorEmployeeId: await sessionActorEmployeeId(session)
  });
  return { ok: true, changed };
});
