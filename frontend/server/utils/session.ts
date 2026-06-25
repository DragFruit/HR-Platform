import type { H3Event } from 'h3';
import type { SessionUser } from './credentials';
import { findCredentialById } from './credentials';

const COOKIE_NAME = 'vbi-session';

export function setVbiSession(event: H3Event, user: SessionUser) {
  setCookie(event, COOKIE_NAME, JSON.stringify(user), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14
  });
}

export function clearVbiSession(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: '/' });
}

export function getVbiSession(event: H3Event): SessionUser | null {
  const raw = getCookie(event, COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionUser;

    if (parsed.auth_source === 'bitrix' && parsed.bitrix_user_id) {
      if (parsed.id !== parsed.bitrix_user_id) return null;
      if (!parsed.email?.trim()) return null;
      return parsed;
    }

    const verified = findCredentialById(parsed.id);
    if (!verified || verified.email.toLowerCase() !== parsed.email.toLowerCase()) {
      return null;
    }
    return verified;
  } catch {
    return null;
  }
}

export function requireVbiSession(event: H3Event): SessionUser {
  const session = getVbiSession(event);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Требуется авторизация' });
  }
  return session;
}
