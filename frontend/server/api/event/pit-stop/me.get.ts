import { requireVbiSession } from '../../../utils/session';
import {
  completedCount,
  findPair,
  findPlayer,
  myCipherHalf,
  partnerOf,
  readPitStopForRequest
} from '../../../utils/pitStopStore';
import {
  buildHubTimeline,
  isCheckpointUnlocked,
  isPitStopGameStopped,
  PIT_STOP_CHECKPOINTS
} from '../../../../app/events/pit-stop-14/timeline';
import { pitStopCopy } from '../../../../app/events/pit-stop-14/copy';
import type { PitStopCheckpointId } from '../../../../app/events/pit-stop-14/types';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const state = await readPitStopForRequest();
  const now = new Date();
  const stopped = isPitStopGameStopped(now);
  let player = findPlayer(state, session.id);

  const pair = player ? findPair(state, player.pairId) : null;
  const partner = pair ? partnerOf(pair, session.id) : null;
  const role = partner?.role ?? null;

  const hub = buildHubTimeline(now).map((item) => {
    const status = player?.checkpoints[item.id] ?? (item.unlocked ? 'open' : 'locked');
    return {
      ...item,
      status: stopped && status !== 'done' ? 'stopped' : status
    };
  });

  const blindRole =
    pair && role
      ? role === 'A'
        ? pair.blindRoleA
        : pair.blindRoleA === 'navigator'
          ? 'pilot'
          : 'navigator'
      : null;

  return {
    stopped,
    player: player
      ? {
          userId: player.userId,
          name: player.name,
          pairId: player.pairId,
          role,
          isRemote: player.isRemote,
          completed: completedCount(player),
          coffeeApproved: Boolean(player.coffeeApproved),
          rewardsGranted: Boolean(player.rewardsGranted)
        }
      : null,
    partner: partner
      ? { userId: partner.partnerId, name: partner.partnerName }
      : null,
    cipherHalf: pair && role ? myCipherHalf(pair, role) : null,
    blindRole,
    hub,
    checkpoints: PIT_STOP_CHECKPOINTS.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      unlockDate: c.unlockDate,
      unlocked: isCheckpointUnlocked(c.id as PitStopCheckpointId, now),
      copy: pitStopCopy(c.id as PitStopCheckpointId, partner?.partnerName || 'напарник', {
        blindRole: blindRole ?? undefined
      })
    }))
  };
});
