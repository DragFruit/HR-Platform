import { clearVbiSession } from '../../utils/session';

const OAUTH_STATE_COOKIES = ['bitrix-oauth-state', 'bitrix-oauth-state-staging', 'bitrix-oauth-state-dev'];

export default defineEventHandler((event) => {
  clearVbiSession(event);
  for (const name of OAUTH_STATE_COOKIES) {
    deleteCookie(event, name, { path: '/' });
  }
  return { ok: true };
});
