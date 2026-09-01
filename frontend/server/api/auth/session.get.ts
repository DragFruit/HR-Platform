import { getVbiSessionChecked, refreshBitrixSessionRoleIfNeeded } from '../../utils/session';

export default defineEventHandler(async (event) => {
  let user = await getVbiSessionChecked(event);
  if (!user) {
    return { ok: false, user: null };
  }
  user = await refreshBitrixSessionRoleIfNeeded(event, user);
  return { ok: true, user };
});
