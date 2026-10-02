import { requireVbiSession } from '../../../../utils/session';
import { isValidLapMs, readRaceRecords, submitLap } from '../../../../utils/pitStopRaceStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ ms?: unknown; color?: unknown }>(event);
  if (!isValidLapMs(body?.ms)) {
    throw createError({ statusCode: 400, statusMessage: 'Круг не засчитан' });
  }
  const { record, improved } = await submitLap({
    userId: session.id,
    name: session.name,
    department: session.department || '',
    ms: body.ms,
    color: body.color
  });
  const records = await readRaceRecords();
  const rank = records.findIndex((r) => r.userId === session.id) + 1;
  return { bestMs: record.bestMs, laps: record.laps, improved, rank };
});
