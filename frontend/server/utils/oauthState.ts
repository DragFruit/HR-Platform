import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

function signNonce(nonce: string, secret: string): string {
  return createHmac('sha256', secret).update(nonce).digest('hex');
}

/** State для OAuth: nonce + HMAC — проверяется без cookie (важно при редиректе между :8080 и :80). */
export function createOAuthState(secret: string): string {
  const nonce = randomBytes(16).toString('hex');
  return `${nonce}.${signNonce(nonce, secret)}`;
}

export function verifyOAuthState(state: string, secret: string): boolean {
  const trimmed = state.trim();
  const dot = trimmed.indexOf('.');
  if (dot <= 0) return false;

  const nonce = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  if (!nonce || !sig) return false;

  const expected = signNonce(nonce, secret);
  if (expected.length !== sig.length) return false;

  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(sig, 'utf8'));
  } catch {
    return false;
  }
}
