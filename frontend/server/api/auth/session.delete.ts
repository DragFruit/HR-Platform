import { clearVbiSession } from '../../utils/session';

export default defineEventHandler((event) => {
  clearVbiSession(event);
  return { ok: true };
});
