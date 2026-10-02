import { requireVbiSession } from '../../../../utils/session';
import { isPitStopGameStopped, PIT_STOP_STOP_AT } from '../../../../../app/events/pit-stop-14/timeline';
import {
  bestAsOf,
  ensureRaceFinalized,
  leaderboardSlots,
  raceRecordsForLeaderboard,
  readRaceRecords
} from '../../../../utils/pitStopRaceStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const records = raceRecordsForLeaderboard(await readRaceRecords());
  const stopped = isPitStopGameStopped();
  const { publishedAt, nextAt } = leaderboardSlots();
  /** После стопа — финальный срез на 03:00 10.10 МСК (включая круги после полуночи). */
  const cutoff = stopped ? new Date(PIT_STOP_STOP_AT) : publishedAt;

  if (stopped) {
    await ensureRaceFinalized();
  }

  const rows = records
    .map((r) => ({ r, best: bestAsOf(r, cutoff) }))
    .filter((x): x is { r: (typeof records)[number]; best: { ms: number; at: string } } => x.best != null)
    .sort((a, b) => a.best.ms - b.best.ms || a.best.at.localeCompare(b.best.at))
    .map(({ r, best }, i) => ({
      rank: i + 1,
      userId: r.userId,
      name: r.name,
      department: r.department,
      bestMs: best.ms,
      color: r.color,
      isMe: r.userId === session.id
    }));

  const mine = records.find((r) => r.userId === session.id);

  return {
    rows,
    top: rows.slice(0, 3),
    rest: rows.slice(3),
    me: rows.find((r) => r.isMe) ?? null,
    total: rows.length,
    myLiveBestMs: stopped ? (rows.find((r) => r.isMe)?.bestMs ?? null) : (mine?.bestMs ?? null),
    publishedAt: cutoff.toISOString(),
    nextAt: stopped ? null : nextAt.toISOString(),
    closed: stopped,
    closesAt: PIT_STOP_STOP_AT
  };
});
