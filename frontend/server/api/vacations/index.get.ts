import { applyReservationLifecycle } from '../../utils/vacationReservationLifecycle';
import { requireVbiSession } from '../../utils/session';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  return applyReservationLifecycle();
});
