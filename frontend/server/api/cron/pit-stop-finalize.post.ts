import { assertCronLocalhostIfRequired, assertCronToken } from '../../utils/cronAuth';
import { completedCount, mutatePitStop } from '../../utils/pitStopStore';
import { isPitStopRewardsDue } from '../../../app/events/pit-stop-14/timeline';
import {
  PIT_STOP_ACHIEVEMENT_ID,
  PIT_STOP_SKIN_ID
} from '../../../app/events/pit-stop-14/rewards';

/**
 * Cron 10.10 ~10:00 МСК: игрокам 8/8 — флаги награды.
 * Выдача в каталог ачивок / скин — отдельный слой после ответа по секции/публичности.
 */
export default defineEventHandler(async (event) => {
  assertCronToken(event);
  assertCronLocalhostIfRequired(event);
  if (!isPitStopRewardsDue()) {
    return { ok: false, reason: 'too_early' };
  }

  return mutatePitStop((state) => {
    const granted: number[] = [];
    for (const p of state.players) {
      if (completedCount(p) < 8 || p.rewardsGranted) continue;
      p.rewardsGranted = true;
      granted.push(p.userId);
    }
    state.finalizedAt = new Date().toISOString();
    return {
      ok: true,
      granted,
      achievementId: PIT_STOP_ACHIEVEMENT_ID,
      skinId: PIT_STOP_SKIN_ID,
      note: 'Флаги выставлены; каталог ачивок и лента бота — следующим коммитом после ОК'
    };
  }, { reason: 'pit-stop:finalize-cron' });
});
