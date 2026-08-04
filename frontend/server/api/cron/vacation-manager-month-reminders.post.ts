import { runVacationManagerMonthReminders } from '../../utils/vacationManagerMonthReminder';

/**
 * Cron 15-го числа: руководителям — кто из команды в отпуске в следующем месяце (approved, старт в том месяце).
 * Токен: X-Cron-Token / ?token= = VACATION_PRE_REMINDER_CRON_SECRET / CRON_SECRET.
 * Тест не 15-го: ?force=1&dry_run=1
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
  const force =
    String(query.force || '').trim() === '1' ||
    String(query.force || '').trim().toLowerCase() === 'true';

  const asOfRaw = String(query.as_of || query.asOf || '').trim();
  let today: Date | undefined;
  if (asOfRaw) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOfRaw);
    if (!m) {
      throw createError({ statusCode: 400, statusMessage: 'as_of должен быть YYYY-MM-DD' });
    }
    today = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  const result = await runVacationManagerMonthReminders({ dryRun, force, today });
  console.info('[vacation-manager-month-reminder]', JSON.stringify(result));
  return { ok: true, ...result };
});
