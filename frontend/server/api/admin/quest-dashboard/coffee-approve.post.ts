import { requireRole } from '../../../utils/requireRole';
import { mutatePitStop, setCheckpointStatus } from '../../../utils/pitStopStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin']);
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
  });
});
