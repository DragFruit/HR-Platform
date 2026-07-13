import { requireVbiSession } from '../../utils/session';
import { patchReservationMonthlyCap } from '../../utils/vacationReservationCapMutations';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody(event);
  return patchReservationMonthlyCap(session, body);
});
