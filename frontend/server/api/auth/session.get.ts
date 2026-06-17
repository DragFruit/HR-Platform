import { getVbiSession } from '../../utils/session';

export default defineEventHandler((event) => {
  const user = getVbiSession(event);
  if (!user) {
    return { ok: false, user: null };
  }
  return { ok: true, user };
});
