/**
 * Миграции PostgreSQL при старте. Только если задан DATABASE_URL — иначе ничего не делает
 * (сегодня стенды на JSON). Ошибка миграции не роняет процесс: логируем и выключаем DB,
 * JSON-функции продолжают работать.
 */
import { disableDb, getDatabaseUrl, getDb } from '../db/client';
import { resolveMigrationsDir, runMigrations } from '../db/migrate';

export default defineNitroPlugin(() => {
  // setTimeout: дать отработать load-bitrix-env (он может подложить DATABASE_URL из .env).
  setTimeout(() => {
    if (!getDatabaseUrl()) return;
    if (!getDb()) return; // отключено проверкой стенда — причина уже в логе

    const dir = resolveMigrationsDir();
    if (!dir) {
      disableDb('не найдена папка миграций');
      console.error('[db] миграции не найдены (ожидалось .output/server/db/migrations) — DB выключена');
      return;
    }

    const startedAt = Date.now();
    void runMigrations(getDatabaseUrl(), dir)
      .then((applied) => {
        console.info(`[db] migrations ok applied=${applied} in ${Date.now() - startedAt}ms`);
      })
      .catch((err) => {
        disableDb('миграции упали');
        console.error('[db] миграции упали — DB выключена до рестарта, JSON работает:', err?.message || err);
      });
  }, 0);
});
