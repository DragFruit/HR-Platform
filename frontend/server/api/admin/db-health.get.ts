import { getDbDisabledReason, getSql, isDbEnabled } from '../../db/client';
import { requireRole } from '../../utils/requireRole';
import { getUserNotificationsBackend } from '../../utils/userNotificationsStore';
import { getAccessDenylistBackend, getCoreBackend } from '../../utils/coreStore';
import { getAdminNotificationsBackend } from '../../utils/adminNotificationsStore';
import { getVacationReminderLogsBackend } from '../../utils/vacationReminderLogsBackend';
import { getVacationsBackend } from '../../utils/vacationsStore';

/** Проверка PostgreSQL на стенде: {enabled, ok, latencyMs, migrations, domains}. Только admin. */
export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin']);

  /** Где сейчас живёт каждый перенесённый домен: postgres | json. */
  const domains = {
    notifications: await getUserNotificationsBackend(),
    core: await getCoreBackend(),
    vacations: await getVacationsBackend(),
    adminNotifications: await getAdminNotificationsBackend(),
    accessDenylist: await getAccessDenylistBackend(),
    vacationReminders: await getVacationReminderLogsBackend()
  };
  const sql = getSql();
  if (!isDbEnabled() || !sql) {
    return { enabled: false, ok: false, latencyMs: null, migrations: 0, reason: getDbDisabledReason(), domains };
  }

  const startedAt = Date.now();
  try {
    await sql`select 1`;
    const latencyMs = Date.now() - startedAt;
    const [row] = await sql<{ n: number | null }[]>`
      select case when to_regclass('drizzle.__drizzle_migrations') is null then 0
        else (select count(*)::int from drizzle.__drizzle_migrations) end as n`;
    return { enabled: true, ok: true, latencyMs, migrations: row?.n ?? 0, domains };
  } catch (err: any) {
    return {
      enabled: true,
      ok: false,
      latencyMs: Date.now() - startedAt,
      migrations: 0,
      domains,
      error: String(err?.code || err?.message || 'db error')
    };
  }
});
