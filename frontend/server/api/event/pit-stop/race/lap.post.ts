import { requireVbiSession } from '../../../../utils/session';
import { isPitStopGameStopped } from '../../../../../app/events/pit-stop-14/timeline';
import { isValidLapMs, submitLap } from '../../../../utils/pitStopRaceStore';
import { racePilotFromSession } from '../../../../utils/pitStopRacePilot';
import { verifyRaceToken } from '../../../../utils/pitStopRaceToken';
import {
  sanitizeLapTelemetry,
  scoreLapBotSuspicion,
  shouldFlagCheat
} from '../../../../utils/pitStopAntiCheat';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (isPitStopGameStopped()) {
    throw createError({ statusCode: 403, statusMessage: 'Ивент завершён' });
  }
  const body = await readBody<{
    ms?: unknown;
    color?: unknown;
    raceToken?: unknown;
    telemetry?: unknown;
  }>(event);
  if (!isValidLapMs(body?.ms)) {
    throw createError({ statusCode: 400, statusMessage: 'Круг не засчитан' });
  }
  if (!verifyRaceToken(body?.raceToken, session.id)) {
    throw createError({ statusCode: 403, statusMessage: 'Нужен новый заход на хаб' });
  }

  const telemetry = sanitizeLapTelemetry(body?.telemetry, body.ms);
  const { score, reasons } = scoreLapBotSuspicion({ ms: body.ms, telemetry });
  const cheatFlag = shouldFlagCheat(score) ? { score, reasons } : null;

  const pilot = await racePilotFromSession(session);
  const { record, improved } = await submitLap({
    userId: session.id,
    name: pilot.name,
    department: pilot.department,
    ms: body.ms,
    color: body.color,
    cheatFlag
  });
  return {
    bestMs: record.bestMs,
    laps: record.laps,
    improved,
    flagged: Boolean(cheatFlag)
  };
});
