import { requireVbiSession } from '../../../../utils/session';
import { bestAsOf, leaderboardSlots, readRaceRecords } from '../../../../utils/pitStopRaceStore';

const TOP = 20;

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const records = await readRaceRecords();
  const { publishedAt, nextAt } = leaderboardSlots();

  const rows = records
    .map((r) => ({ r, best: bestAsOf(r, publishedAt) }))
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
    top: rows.slice(0, TOP),
    me: rows.find((r) => r.isMe) ?? null,
    total: rows.length,
    myLiveBestMs: mine?.bestMs ?? null,
    publishedAt: publishedAt.toISOString(),
    nextAt: nextAt.toISOString()
  };
});
