import { requireVbiSession } from '../../../../utils/session';
import { isPitStopGameStopped } from '../../../../../app/events/pit-stop-14/timeline';
import { isValidLapMs, submitLap } from '../../../../utils/pitStopRaceStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (session.role === 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Админу игра недоступна' });
  }
  if (isPitStopGameStopped()) {
    throw createError({ statusCode: 403, statusMessage: 'Ивент завершён' });
  }
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
  return { bestMs: record.bestMs, laps: record.laps, improved };
});
