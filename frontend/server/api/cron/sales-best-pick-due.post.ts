import { runSalesBestPickDue } from '../../utils/salesBestPickDue';

/**
 * Ежедневный cron: 29-го (МСК) — уведомление админу выбрать лучшего ОП.
 * ?force=1 — тест «как будто 29-е».
 */
export default defineEventHandler(async (event) => {
  const expected = String(process.env.CRON_SECRET || '').trim();
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

  const force =
    String(query.force || '').trim() === '1' ||
    String(query.as_day || '').trim() === '29';
  const period = String(query.period || '').trim() || undefined;

  const result = await runSalesBestPickDue({ force, period });
  console.info('[sales-best-pick-due]', JSON.stringify(result));
  return { ok: true, ...result };
});
