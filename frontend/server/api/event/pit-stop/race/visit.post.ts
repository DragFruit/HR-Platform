import { requireVbiSession } from '../../../../utils/session';
import { recordRaceVisit } from '../../../../utils/pitStopRaceStore';
import { racePilotFromSession } from '../../../../utils/pitStopRacePilot';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const pilot = await racePilotFromSession(session);
  const { visit, created } = await recordRaceVisit({
    userId: session.id,
    name: pilot.name
  });
  return { ok: true, created, at: visit.at };
});
