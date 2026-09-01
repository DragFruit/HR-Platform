import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SessionUser } from './credentials';
import { getDeployAppEnv } from './appEnv';

/** Абсолютный TTL сессии с момента выдачи / последнего продления. */
export const SESSION_TTL_SEC = 8 * 60 * 60; // 8 часов

/** Продлевать cookie, если до exp осталось меньше этого. */
export const SESSION_SLIDE_THRESHOLD_SEC = 4 * 60 * 60; // 4 часа

type SignedSessionPayload = SessionUser & {
  iat: number;
  exp: number;
};

function sessionSigningSecret(): string {
  const dedicated = String(process.env.VBI_SESSION_SECRET || '').trim();
  if (dedicated) return dedicated;

  const bitrix = String(process.env.BITRIX_CLIENT_SECRET || '').trim();
  if (bitrix) return `vbi-session:${bitrix}`;

  if (getDeployAppEnv() === 'production') {
    throw createError({
      statusCode: 503,
      statusMessage: 'VBI_SESSION_SECRET или BITRIX_CLIENT_SECRET не задан — сессии отключены'
    });
  }

  return 'vbi-dev-session-secret-not-for-production';
}

function signBody(body: string): string {
  return createHmac('sha256', sessionSigningSecret()).update(body).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  try {
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function encodeSignedSession(
  user: SessionUser,
  nowSec = Math.floor(Date.now() / 1000),
  ttlSec = SESSION_TTL_SEC
): string {
  const payload: SignedSessionPayload = {
    ...user,
    iat: nowSec,
    exp: nowSec + ttlSec
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${signBody(body)}`;
}

export function decodeSignedSession(raw: string): SessionUser | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;

  // Legacy: сырой JSON без подписи — отклоняем (форс-релогин после выкладки).
  if (trimmed.startsWith('{')) return null;

  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0) return null;

  const body = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  if (!body || !sig || !safeEqual(signBody(body), sig)) return null;

  try {
    const json = Buffer.from(body, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as SignedSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < now) return null;
    if (typeof parsed.id !== 'number' || !parsed.email) return null;

    const { iat: _iat, exp: _exp, ...user } = parsed;
    return user as SessionUser;
  } catch {
    return null;
  }
}

/** Нужно ли перевыпустить cookie (скользящее продление). */
export function shouldSlideSession(raw: string): boolean {
  const trimmed = String(raw || '').trim();
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0) return false;
  try {
    const body = trimmed.slice(0, dot);
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      exp?: number;
    };
    if (typeof parsed.exp !== 'number') return false;
    const remaining = parsed.exp - Math.floor(Date.now() / 1000);
    return remaining > 0 && remaining < SESSION_SLIDE_THRESHOLD_SEC;
  } catch {
    return false;
  }
}

export function sessionCookieSecure(): boolean {
  const forced = String(process.env.VBI_COOKIE_SECURE || '').trim().toLowerCase();
  if (forced === '1' || forced === 'true') return true;
  if (forced === '0' || forced === 'false') return false;

  const publicUrl = String(
    process.env.APP_PUBLIC_URL || process.env.BITRIX_REDIRECT_URI || ''
  ).trim();
  if (publicUrl.startsWith('https://')) return true;
  if (publicUrl.startsWith('http://')) return false;

  // Fallback: staging/production only if явно https-окружение не определено — не форсим Secure на голом HTTP-бою.
  return false;
}
