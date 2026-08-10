import type { SessionUser } from './credentials';
import { decodeSignedSession, encodeSignedSession } from './sessionToken';

/** Короткий TTL: ticket только для handoff после OAuth (URL / form), не как долгая сессия. */
const TICKET_TTL_SEC = 2 * 60;

/**
 * Подписанный билет входа (HMAC, как cookie-сессия).
 * Не зависит от in-memory Map — переживает рестарт и подходит для first-party GET/POST.
 */
export function createOAuthLoginTicket(user: SessionUser): string {
  return encodeSignedSession(user, Math.floor(Date.now() / 1000), TICKET_TTL_SEC);
}

export function consumeOAuthLoginTicket(id: string): SessionUser | null {
  return decodeSignedSession(String(id || '').trim());
}
