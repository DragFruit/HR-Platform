import { requireVbiSession } from '../../utils/session';
import { requireRole } from '../../utils/requireRole';
import { listAttempts, countUnseenAttempts } from '../../utils/adaptationStore';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const mine = query.mine === 'true' || query.mine === '1';

  if (mine) {
    const session = requireVbiSession(event);
    const attempts = await listAttempts({ platform_user_id: session.id });
    return { attempts, unseen_count: 0 };
  }

  requireRole(event, ['admin', 'hr']);
  const attempts = await listAttempts({
    employee_id: query.employee_id ? Number(query.employee_id) : undefined,
    phase: query.phase ? String(query.phase) : undefined,
    unseen: query.unseen === 'true' || query.unseen === '1'
  });
  const unseen_count = await countUnseenAttempts();
  return { attempts, unseen_count };
});
