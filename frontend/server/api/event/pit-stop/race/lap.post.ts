import { requireVbiSession } from '../../../../utils/session';
import { isPitStopGameStopped } from '../../../../../app/events/pit-stop-14/timeline';
import { isValidLapMs, submitLap } from '../../../../utils/pitStopRaceStore';
import { racePilotFromSession } from '../../../../utils/pitStopRacePilot';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (isPitStopGameStopped()) {
    throw createError({ statusCode: 403, statusMessage: 'Ивент завершён' });
  }
  const body = await readBody<{ ms?: unknown; color?: unknown }>(event);
  if (!isValidLapMs(body?.ms)) {
    throw createError({ statusCode: 400, statusMessage: 'Круг не засчитан' });
  }
  const pilot = await racePilotFromSession(session);
  const { record, improved } = await submitLap({
    userId: session.id,
    name: pilot.name,
    department: pilot.department,
    ms: body.ms,
    color: body.color
  });
  return { bestMs: record.bestMs, laps: record.laps, improved };
});
