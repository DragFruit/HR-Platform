import { createHmac, timingSafeEqual } from 'node:crypto';
import { getDeployAppEnv } from './appEnv';

/** Токен заезда: подпись + userId + expiry (~2 ч). */
const RACE_TOKEN_TTL_SEC = 2 * 60 * 60;

type RaceTokenPayload = { uid: number; exp: number };

function raceTokenSecret(): string {
  const dedicated = String(process.env.VBI_SESSION_SECRET || '').trim();
  if (dedicated) return `vbi-race:${dedicated}`;
  const bitrix = String(process.env.BITRIX_CLIENT_SECRET || '').trim();
  if (bitrix) return `vbi-race:${bitrix}`;
  if (getDeployAppEnv() === 'production') {
    throw createError({
      statusCode: 503,
      statusMessage: 'VBI_SESSION_SECRET или BITRIX_CLIENT_SECRET не задан'
    });
  }
  return 'vbi-dev-race-token-not-for-production';
}

function signBody(body: string): string {
  return createHmac('sha256', raceTokenSecret()).update(body).digest('base64url');
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

export function issueRaceToken(userId: number, nowSec = Math.floor(Date.now() / 1000)): string {
  const payload: RaceTokenPayload = { uid: userId, exp: nowSec + RACE_TOKEN_TTL_SEC };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${signBody(body)}`;
}

export function verifyRaceToken(token: unknown, userId: number): boolean {
  if (typeof token !== 'string' || !token) return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig || !safeEqual(signBody(body), sig)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as RaceTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed || typeof parsed.uid !== 'number' || typeof parsed.exp !== 'number') return false;
    if (parsed.uid !== userId) return false;
    if (parsed.exp < now) return false;
    return true;
  } catch {
    return false;
  }
}
