import { requireVbiSession } from '../../../../utils/session';
import { ensureRaceFinalized } from '../../../../utils/pitStopRaceStore';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  const { winners, finalizedAt } = await ensureRaceFinalized();
  return { winners, finalizedAt };
});
