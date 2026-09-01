import { requireVbiSession } from '../../utils/session';
import {
  listProfileActivity,
  PROFILE_ACTIVITY_KINDS
} from '../../utils/profileActivityStore';
import { publishRevealedSalesBestActivities } from '../../utils/salesBestAwardsStore';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  // Автономия: если наступил reveal_on — событие сразу в ленте
  await publishRevealedSalesBestActivities().catch(() => {});

  const query = getQuery(event);
  const employeeId = Number(query.employee_id);
  const platformUserId = Number(query.platform_user_id);

  const items = await listProfileActivity({
    employee_id: Number.isFinite(employeeId) && employeeId > 0 ? employeeId : undefined,
    platform_user_id:
      Number.isFinite(platformUserId) && platformUserId > 0 ? platformUserId : undefined
  });

  return { items, kind_options: PROFILE_ACTIVITY_KINDS };
});
