import { requireVbiSession } from '../../../../utils/session';
import { recordRaceVisit } from '../../../../utils/pitStopRaceStore';
import { racePilotFromSession } from '../../../../utils/pitStopRacePilot';
import { issueRaceToken } from '../../../../utils/pitStopRaceToken';
import { sessionActorEmployeeId } from '../../../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const pilot = await racePilotFromSession(session);
  const { visit, created } = await recordRaceVisit({
    userId: session.id,
    name: pilot.name
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'pit-stop-race:visit' });
  const raceToken = issueRaceToken(session.id);
  return { ok: true, created, at: visit.at, raceToken };
});
