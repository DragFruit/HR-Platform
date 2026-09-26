import { requireRole } from '../../utils/requireRole';
import { completedCount, readPitStop } from '../../utils/pitStopStore';
import { PIT_STOP_CHECKPOINTS } from '../../../app/events/pit-stop-14/timeline';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin']);
  const state = await readPitStop();

  const rows = state.players.map((p) => {
    const current =
      PIT_STOP_CHECKPOINTS.map((c) => c.id).find((id) => p.checkpoints[id] !== 'done') ?? 8;
    const status = p.checkpoints[current as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8] ?? 'open';
    return {
      userId: p.userId,
      name: p.name,
      pairId: p.pairId,
      isRemote: p.isRemote,
      completed: completedCount(p),
      point: current,
      status,
      coffeePending: p.checkpoints[5] === 'pending_review',
      coffeePhotoPath: p.coffeePhotoPath ?? null,
      rewardsGranted: Boolean(p.rewardsGranted)
    };
  });

  return {
    pairs: state.pairs.length,
    players: rows,
    coffeeQueue: rows.filter((r) => r.coffeePending),
    finalizedAt: state.finalizedAt
  };
});
