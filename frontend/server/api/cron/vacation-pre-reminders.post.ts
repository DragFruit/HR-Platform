import { runVacationPreReminders } from '../../utils/vacationPreReminder';

/**
 * Ежедневный cron: напоминание отпускнику ровно за 21 день (3 недели).
 * Защита: заголовок X-Cron-Token или ?token= = CRON_SECRET / VACATION_PRE_REMINDER_CRON_SECRET.
 */
export default defineEventHandler(async (event) => {
  const expected = String(
    process.env.VACATION_PRE_REMINDER_CRON_SECRET || process.env.CRON_SECRET || ''
  ).trim();
  if (!expected) {
    throw createError({
      statusCode: 503,
      statusMessage:
        'CRON_SECRET или VACATION_PRE_REMINDER_CRON_SECRET не задан — cron отключён'
    });
  }

  const header = String(getHeader(event, 'x-cron-token') || '').trim();
  const query = getQuery(event);
  const queryToken = String(query.token || '').trim();
  if (header !== expected && queryToken !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Неверный cron token' });
  }

  const dryRun =
    String(query.dry_run || '').trim() === '1' ||
    String(query.dryRun || '').trim() === '1';

  const result = await runVacationPreReminders({ dryRun });
  console.info('[vacation-pre-reminder]', JSON.stringify(result));
  return { ok: true, ...result };
});
