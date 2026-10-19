import { requireRole } from '../../../utils/requireRole';
import { mutatePitStop, setCheckpointStatus } from '../../../utils/pitStopStore';
import { sessionActorEmployeeId } from '../../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin']);
  const body = await readBody<{ userId?: number; all?: boolean }>(event).catch(() => ({}));

  return mutatePitStop((state) => {
    let approved = 0;
    for (const p of state.players) {
      if (p.checkpoints[5] !== 'pending_review') continue;
      if (!body.all && Number(body.userId) !== p.userId) continue;
      p.coffeeApproved = true;
      setCheckpointStatus(p, 5, 'done');
      approved += 1;
      if (!body.all) break;
    }
    return { ok: true, approved };
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'pit-stop:coffee-approve' });
});
