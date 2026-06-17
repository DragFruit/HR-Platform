import { requireVbiSession } from '../../utils/session';
import { loadTrackForClient } from '../../utils/trackLoader';

export default defineEventHandler(async (event) => {
  requireVbiSession(event);
  return loadTrackForClient();
});
