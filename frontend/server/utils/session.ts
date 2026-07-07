import type { H3Event } from 'h3';
import type { SessionUser } from './credentials';
import { findCredentialById } from './credentials';
import { resolveAuthRoleFromEmployees } from './bitrixSync';
import { sessionCookieName } from './appEnv';

export function setVbiSession(event: H3Event, user: SessionUser) {
  const cookieName = sessionCookieName();
  setCookie(event, cookieName, JSON.stringify(user), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14
  });
}

export function clearVbiSession(event: H3Event) {
  deleteCookie(event, sessionCookieName(), { path: '/' });
}

export async function refreshBitrixSessionRoleIfNeeded(
  event: H3Event,
  user: SessionUser
): Promise<SessionUser> {
  if (user.auth_source !== 'bitrix') return user;
  const userId = user.bitrix_user_id ?? user.id;
  const fromEmployees = await resolveAuthRoleFromEmployees(userId);
  if (!fromEmployees || fromEmployees === user.role) return user;
  const updated = { ...user, role: fromEmployees };
  setVbiSession(event, updated);
  return updated;
}

export function getVbiSession(event: H3Event): SessionUser | null {
  const raw = getCookie(event, sessionCookieName());
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

export async function requireVbiSession(event: H3Event): Promise<SessionUser> {
  const session = getVbiSession(event);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Требуется авторизация' });
  }
  return refreshBitrixSessionRoleIfNeeded(event, session);
}
