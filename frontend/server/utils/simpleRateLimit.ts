import type { H3Event } from 'h3';

/**
 * Простой in-memory rate-limit по IP для публичных эндпойнтов (без сессии).
 * Не распределённый (на процесс), но достаточен против случайного флуда —
 * для серьёзной защиты нужен edge/проксёр, это вне фазы 1.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(event: H3Event, key: string, limit: number, windowMs: number): void {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt < now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > limit) {
    throw createError({ statusCode: 429, statusMessage: 'Слишком много попыток, попробуйте позже' });
  }
}
