/**
 * Миграции PostgreSQL при старте. Только если задан DATABASE_URL — иначе ничего не делает.
 * Ошибка миграции не роняет процесс: логируем и выключаем DB, JSON-функции продолжают работать.
 * Этап 2: при DB_NOTIFICATIONS=1 после миграций — разовый импорт уведомлений из JSON.
 * Этап 3: при DB_CORE=1 — разовый импорт сотрудников, overlay руководителей и оргструктуры.
 */
import { disableDb, getDatabaseUrl, getDb } from '../db/client';
import { resolveMigrationsDir, runMigrations } from '../db/migrate';
import { importUserNotificationsFromJson } from '../notifications/importJson';
import { USER_NOTIFICATIONS_JSON_FILE } from '../notifications/jsonStore';
import { notificationsDbFlag, setNotificationsPgReady } from '../utils/userNotificationsStore';
import { importCoreFromJson } from '../core/importJson';
import { defaultCoreJsonFiles } from '../core/jsonStore';
import { coreDbFlag, setCorePgReady } from '../utils/coreStore';

async function importCore(): Promise<boolean> {
  if (!coreDbFlag()) return false;
  const db = getDb();
  if (!db) return false;
  try {
    const parts = await importCoreFromJson(db, defaultCoreJsonFiles());
    for (const p of parts) {
      if (p.status === 'already') {
        console.info(
          `[db] core: ${p.source} импорт уже был ${p.importedAt} (file=${p.fileCount} inserted=${p.inserted} skipped=${p.skipped})`
        );
      } else {
        console.info(
          `[db] core: ${p.source} импорт file=${p.fileCount} inserted=${p.inserted} skipped=${p.skipped} verified=${p.verified}`
        );
      }
    }
    console.info('[db] core: сотрудники и оргструктура на Postgres');
    return true;
  } catch (err: any) {
    console.error('[db] core: импорт из JSON упал — сотрудники и оргструктура остаются на JSON:', err?.message || err);
    return false;
  }
}

function setAllPgReady(ok: boolean) {
  setNotificationsPgReady(ok);
  setCorePgReady(ok);
}

async function importNotifications(): Promise<boolean> {
  if (!notificationsDbFlag()) return false;
  const db = getDb();
  if (!db) return false;
  try {
    const r = await importUserNotificationsFromJson(db, USER_NOTIFICATIONS_JSON_FILE);
    if (r.status === 'already') {
      console.info(
        `[db] notifications: импорт из JSON уже был ${r.importedAt} (file=${r.fileCount} inserted=${r.inserted} skipped=${r.skipped}) — работаем на Postgres`
      );
    } else {
      console.info(
        `[db] notifications: импорт из JSON file=${r.fileCount} inserted=${r.inserted} existing=${r.existing} skipped=${r.skipped} verified=${r.verifiedInDb} — работаем на Postgres`
      );
    }
    return true;
  } catch (err: any) {
    console.error('[db] notifications: импорт из JSON упал — уведомления остаются на JSON:', err?.message || err);
    return false;
  }
}

export default defineNitroPlugin(() => {
  // setTimeout: дать отработать load-bitrix-env (он может подложить DATABASE_URL из .env).
  setTimeout(() => {
    if (!getDatabaseUrl() || !getDb()) {
      setAllPgReady(false);
      return; // нет базы или отключено проверкой стенда — причина уже в логе
    }

    const dir = resolveMigrationsDir();
    if (!dir) {
      disableDb('не найдена папка миграций');
      setAllPgReady(false);
      console.error('[db] миграции не найдены (ожидалось .output/server/db/migrations) — DB выключена');
      return;
    }

    const startedAt = Date.now();
    void runMigrations(getDatabaseUrl(), dir)
      .then(async (applied) => {
        console.info(`[db] migrations ok applied=${applied} in ${Date.now() - startedAt}ms`);
        setNotificationsPgReady(await importNotifications());
        setCorePgReady(await importCore());
      })
      .catch((err) => {
        disableDb('миграции упали');
        setAllPgReady(false);
        console.error('[db] миграции упали — DB выключена до рестарта, JSON работает:', err?.message || err);
      });
  }, 0);
});
