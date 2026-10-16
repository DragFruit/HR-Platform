import { defineConfig } from 'drizzle-kit';

// npx drizzle-kit generate — новая миграция из server/db/schema (SQL коммитим).
// Применяются миграции при старте сервера (server/plugins/db-migrate.ts), не через drizzle-kit migrate.
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema/index.ts',
  out: './server/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL || 'postgres://localhost:5432/vbi_dev' },
  strict: true
});
