import { requireVbiSession } from '../../utils/session';
import { loadTrackForClient } from '../../utils/trackLoader';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  return loadTrackForClient();
});
