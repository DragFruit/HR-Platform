import { getDbDisabledReason, getSql, isDbEnabled } from '../../db/client';
import { requireRole } from '../../utils/requireRole';

/** Проверка PostgreSQL на стенде: {enabled, ok, latencyMs, migrations}. Только admin. */
export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin']);

  const sql = getSql();
  if (!isDbEnabled() || !sql) {
    return { enabled: false, ok: false, latencyMs: null, migrations: 0, reason: getDbDisabledReason() };
  }

  const startedAt = Date.now();
  try {
    await sql`select 1`;
    const latencyMs = Date.now() - startedAt;
    const [row] = await sql<{ n: number | null }[]>`
      select case when to_regclass('drizzle.__drizzle_migrations') is null then 0
        else (select count(*)::int from drizzle.__drizzle_migrations) end as n`;
    return { enabled: true, ok: true, latencyMs, migrations: row?.n ?? 0 };
  } catch (err: any) {
    return {
      enabled: true,
      ok: false,
      latencyMs: Date.now() - startedAt,
      migrations: 0,
      error: String(err?.code || err?.message || 'db error')
    };
  }
});
