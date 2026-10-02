import { requireVbiSession } from '../../../../utils/session';
import { readRaceRecords } from '../../../../utils/pitStopRaceStore';

const TOP = 20;

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const records = await readRaceRecords();
  const rows = records.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    name: r.name,
    department: r.department,
    bestMs: r.bestMs,
    color: r.color,
    laps: r.laps,
    isMe: r.userId === session.id
  }));
  return {
    top: rows.slice(0, TOP),
    me: rows.find((r) => r.isMe) ?? null,
    total: rows.length
  };
});
