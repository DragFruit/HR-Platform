import type { H3Event } from 'h3';

/** Проверка X-Cron-Token / ?token= против CRON_SECRET (и опционального alt). */
export function assertCronToken(event: H3Event, altEnvKeys: string[] = []): void {
  const keys = ['CRON_SECRET', ...altEnvKeys];
  let expected = '';
  for (const key of keys) {
    const v = String(process.env[key] || '').trim();
    if (v) {
      expected = v;
      break;
    }
  }
  if (!expected) {
    throw createError({
      statusCode: 503,
      statusMessage: 'CRON_SECRET не задан — cron отключён'
    });
  }

  const header = String(getHeader(event, 'x-cron-token') || '').trim();
  const query = getQuery(event);
  const queryToken = String(query.token || '').trim();
  if (header !== expected && queryToken !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Неверный cron token' });
  }
}

/**
 * Опционально: только loopback (systemd на той же машине).
 * Включать: CRON_LOCALHOST_ONLY=1
 */
export function assertCronLocalhostIfRequired(event: H3Event): void {
  if (String(process.env.CRON_LOCALHOST_ONLY || '').trim() !== '1') return;
  const ip = getRequestIP(event, { xForwardedFor: false }) || '';
  const ok = ip === '127.0.0.1' || ip === '::1' || ip === ':ffff:127.0.0.1';
  if (!ok) {
    throw createError({ statusCode: 403, statusMessage: 'Cron только с localhost' });
  }
}
