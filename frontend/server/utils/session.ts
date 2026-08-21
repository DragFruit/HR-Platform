import type { H3Event } from 'h3';
import type { SessionUser } from './credentials';
import { findCredentialById } from './credentials';
import { sessionCookieName } from './appEnv';
import { isBitrixUserInRoster, resolveAuthRoleFromEmployees } from './bitrixSync';
import {
  isAccessRevokedForIdentity,
  purgeExpiredRevocationArtifacts
} from './employeeAccessDenylist';
import {
  decodeSignedSession,
  encodeSignedSession,
  SESSION_TTL_SEC,
  sessionCookieSecure,
  shouldSlideSession
} from './sessionToken';

let lastPurgeAt = 0;
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

async function maybePurgeExpiredArtifacts() {
  const now = Date.now();
  if (now - lastPurgeAt < PURGE_INTERVAL_MS) return;
  lastPurgeAt = now;
  try {
    await purgeExpiredRevocationArtifacts();
  } catch (err) {
    console.warn('[session] purgeExpiredRevocationArtifacts failed:', err);
  }
}

function cookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SEC,
    secure: sessionCookieSecure()
  };
}

export function setVbiSession(event: H3Event, user: SessionUser) {
  setCookie(event, sessionCookieName(), encodeSignedSession(user), cookieOptions());
}

export function clearVbiSession(event: H3Event) {
  deleteCookie(event, sessionCookieName(), { path: '/' });
}

async function denyIfAccessNotAllowed(
  event: H3Event,
  user: SessionUser
): Promise<SessionUser | null> {
  if (await isAccessRevokedForIdentity(user)) {
    clearVbiSession(event);
    return null;
  }

  if (user.auth_source === 'bitrix' || user.auth_source === 'vibe') {
    const bitrixId = Number(user.bitrix_user_id ?? user.id);
    if (!(await isBitrixUserInRoster(bitrixId))) {
      clearVbiSession(event);
      return null;
    }
  }

  return user;
}

export async function refreshBitrixSessionRoleIfNeeded(
  event: H3Event,
  user: SessionUser
): Promise<SessionUser> {
  if (user.auth_source !== 'bitrix' && user.auth_source !== 'vibe') return user;
  const userId = user.bitrix_user_id ?? user.id;
  const fromEmployees = await resolveAuthRoleFromEmployees(userId);
  if (!fromEmployees || fromEmployees === user.role) return user;
  const updated = { ...user, role: fromEmployees };
  setVbiSession(event, updated);
  return updated;
}

function maybeSlideSessionCookie(event: H3Event, user: SessionUser) {
  const raw = getCookie(event, sessionCookieName());
  if (raw && shouldSlideSession(raw)) {
    setVbiSession(event, user);
  }
}

export function getVbiSession(event: H3Event): SessionUser | null {
  const raw = getCookie(event, sessionCookieName());
  if (!raw) return null;
  try {
    const parsed = decodeSignedSession(raw);
    if (!parsed) return null;

    if (
      (parsed.auth_source === 'bitrix' || parsed.auth_source === 'vibe') &&
      parsed.bitrix_user_id
    ) {
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

/** Сессия с проверкой denylist + членства в справочнике (Bitrix). */
export async function getVbiSessionChecked(event: H3Event): Promise<SessionUser | null> {
  const session = getVbiSession(event);
  if (!session) return null;
  return denyIfAccessNotAllowed(event, session);
}

export async function requireVbiSession(event: H3Event): Promise<SessionUser> {
  void maybePurgeExpiredArtifacts();
  const session = await getVbiSessionChecked(event);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Требуется авторизация' });
  }
  const refreshed = await refreshBitrixSessionRoleIfNeeded(event, session);
  maybeSlideSessionCookie(event, refreshed);
  return refreshed;
}
