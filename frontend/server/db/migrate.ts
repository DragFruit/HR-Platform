import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Ключ pg_advisory_lock для миграций (произвольная константа, одна на приложение). */
export const MIGRATION_LOCK_KEY = 72_461_001;

/**
 * Где лежат SQL-миграции:
 * - prod/staging: `.output/server/db/migrations` (копирует хук nitro `compiled` в nuxt.config.ts);
 * - dev: `frontend/server/db/migrations`.
 */
export function resolveMigrationsDir(): string | null {
  const candidates = [
    process.env.DB_MIGRATIONS_DIR,
    process.argv[1] ? join(dirname(resolve(process.argv[1])), 'db/migrations') : '',
    join(process.cwd(), '.output/server/db/migrations'),
    join(process.cwd(), 'server/db/migrations')
  ].filter(Boolean) as string[];
  return candidates.find((dir) => existsSync(join(dir, 'meta/_journal.json'))) ?? null;
}

/**
 * Применить миграции на отдельном соединении (max: 1), под advisory lock —
 * чтобы два процесса на одной базе не накатывали одновременно.
 */
export async function runMigrations(url: string, migrationsFolder: string): Promise<number> {
  const sql = postgres(url, { max: 1, connect_timeout: 10, onnotice: () => {} });
  try {
    await sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    try {
      await migrate(drizzle(sql), { migrationsFolder });
    } finally {
      await sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    }
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from drizzle.__drizzle_migrations`;
    return row?.n ?? 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
