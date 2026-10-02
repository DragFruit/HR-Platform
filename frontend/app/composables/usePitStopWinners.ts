import { PIT_STOP_ACHIEVEMENT_ID } from '~/events/pit-stop-14/rewards';

type PitStopWinnerRow = {
  userId: number;
  rank: number;
  name: string;
  bestMs: number;
};

/** Топ-3 Pit Stop после финализации (10.10 03:00 МСК). */
export function usePitStopWinners() {
  const winners = useState<PitStopWinnerRow[]>('pit-stop-race-winners', () => []);
  const finalizedAt = useState<string | null>('pit-stop-race-finalized-at', () => null);
  const hydrated = useState<boolean>('pit-stop-race-winners-hydrated', () => false);

  const hydrate = async () => {
    if (!import.meta.client) return;
    try {
      const data = await $fetch<{ winners: PitStopWinnerRow[]; finalizedAt: string | null }>(
        '/api/event/pit-stop/race/winners'
      );
      winners.value = Array.isArray(data.winners) ? data.winners : [];
      finalizedAt.value = data.finalizedAt;
    } catch {
      winners.value = [];
      finalizedAt.value = null;
    } finally {
      hydrated.value = true;
    }
  };

  const hasPitStopAchievement = (userId: number | null | undefined) => {
    if (!userId || !finalizedAt.value) return false;
    return winners.value.some((w) => w.userId === userId);
  };

  return {
    winners,
    finalizedAt,
    hydrated,
    hydrate,
    hasPitStopAchievement,
    achievementId: PIT_STOP_ACHIEVEMENT_ID
  };
}
