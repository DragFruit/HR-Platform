/**
 * Миграции PostgreSQL при старте. Только если задан DATABASE_URL — иначе ничего не делает.
 * Ошибка миграции не роняет процесс: логируем и выключаем DB, JSON-функции продолжают работать.
 * Этап 2: при DB_NOTIFICATIONS=1 после миграций — разовый импорт уведомлений из JSON.
 * Этап 3: при DB_CORE=1 — разовый импорт сотрудников, overlay руководителей и оргструктуры.
 * Этап 4: при DB_VACATIONS=1 — разовый импорт vacations.json (заявки, брони, счётчики id).
 * Этап 5: DB_ADMIN_NOTIFICATIONS=1 — admin-notifications.json; DB_CORE=1 — стоп-лист доступа;
 * DB_VACATIONS=1 — журналы напоминаний. У каждого своя готовность: сбой импорта нового домена
 * не откатывает на файлы домены, которые уже живут в Postgres.
 */
import { disableDb, getDatabaseUrl, getDb } from '../db/client';
import { resolveMigrationsDir, runMigrations } from '../db/migrate';
import { importUserNotificationsFromJson } from '../notifications/importJson';
import { USER_NOTIFICATIONS_JSON_FILE } from '../notifications/jsonStore';
import { notificationsDbFlag, setNotificationsPgReady } from '../utils/userNotificationsStore';
import { importCoreFromJson } from '../core/importJson';
import { defaultCoreJsonFiles } from '../core/jsonStore';
import { coreDbFlag, setCorePgReady } from '../utils/coreStore';
import { importVacationsFromJson } from '../vacations/importJson';
import { VACATIONS_JSON_FILE } from '../vacations/jsonStore';
import { setVacationsPgReady, vacationsDbFlag } from '../utils/vacationsStore';
import { importAdminNotificationsFromJson } from '../adminNotifications/importJson';
import { ADMIN_NOTIFICATIONS_JSON_FILE } from '../adminNotifications/jsonStore';
import { adminNotificationsDbFlag, setAdminNotificationsPgReady } from '../utils/adminNotificationsStore';
import { importAccessDenylistFromJson } from '../core/importDenylist';
import { ACCESS_DENYLIST_JSON_FILE } from '../core/accessDenylistStore';
import { setAccessDenylistPgReady } from '../utils/coreStore';
import { importReminderLogFromJson, type ReminderLogImportResult } from '../vacations/reminderLogs';
import { setVacationReminderLogsPgReady } from '../utils/vacationReminderLogsBackend';
import { VACATION_PRE_REMINDER_FILE } from '../utils/vacationPreReminderStore';
import { VACATION_MANAGER_MONTH_REMINDER_FILE } from '../utils/vacationManagerMonthReminderStore';

function logPart(domain: string, p: ReminderLogImportResult | { source: string; status: string; [k: string]: unknown }) {
  const r = p as Record<string, unknown>;
  if (r.status === 'already') {
    console.info(`[db] ${domain}: ${r.source} импорт уже был ${r.importedAt} (file=${r.fileCount} inserted=${r.inserted} skipped=${r.skipped})`);
  } else {
    console.info(`[db] ${domain}: ${r.source} импорт file=${r.fileCount} inserted=${r.inserted} skipped=${r.skipped} verified=${r.verified}`);
  }
}

async function importAdminNotifications(): Promise<boolean> {
  if (!adminNotificationsDbFlag()) return false;
  const db = getDb();
  if (!db) return false;
  try {
    const r = await importAdminNotificationsFromJson(db, ADMIN_NOTIFICATIONS_JSON_FILE);
    logPart('admin-notifications', { source: 'admin-notifications.json', ...r });
    console.info('[db] admin-notifications: уведомления админки на Postgres');
    return true;
  } catch (err: any) {
    console.error('[db] admin-notifications: импорт из JSON упал — уведомления админки остаются на JSON:', err?.message || err);
    return false;
  }
}

async function importAccessDenylist(coreOk: boolean): Promise<boolean> {
  if (!coreOk || !coreDbFlag()) return false;
  const db = getDb();
  if (!db) return false;
  try {
    logPart('core', await importAccessDenylistFromJson(db, ACCESS_DENYLIST_JSON_FILE));
    console.info('[db] core: стоп-лист доступа на Postgres (JSON-файл — зеркало)');
    return true;
  } catch (err: any) {
    console.error('[db] core: импорт стоп-листа упал — стоп-лист остаётся на JSON:', err?.message || err);
    return false;
  }
}

async function importReminderLogs(): Promise<boolean> {
  if (!vacationsDbFlag()) return false;
  const db = getDb();
  if (!db) return false;
  try {
    logPart('vacations', await importReminderLogFromJson(db, 'pre', VACATION_PRE_REMINDER_FILE()));
    logPart('vacations', await importReminderLogFromJson(db, 'manager-month', VACATION_MANAGER_MONTH_REMINDER_FILE()));
    console.info('[db] vacations: журналы напоминаний на Postgres');
    return true;
  } catch (err: any) {
    console.error('[db] vacations: импорт журналов напоминаний упал — журналы остаются на JSON:', err?.message || err);
    return false;
  }
}

async function importVacations(): Promise<boolean> {
  if (!vacationsDbFlag()) return false;
  const db = getDb();
  if (!db) return false;
  try {
    const r = await importVacationsFromJson(db, VACATIONS_JSON_FILE);
    if (r.status === 'already') {
      console.info(
        `[db] vacations: импорт из JSON уже был ${r.importedAt} (file=${r.fileCount} inserted=${r.inserted} skipped=${r.skipped}) — работаем на Postgres`
      );
    } else {
      console.info(
        `[db] vacations: импорт из JSON file=${r.fileCount} requests=${r.requests} reservations=${r.reservations} inserted=${r.inserted} skipped=${r.skipped} verified=${r.verified} — работаем на Postgres`
      );
    }
    return true;
  } catch (err: any) {
    console.error('[db] vacations: импорт из JSON упал — отпуска остаются на JSON:', err?.message || err);
    return false;
  }
}

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
  setVacationsPgReady(ok);
  setAdminNotificationsPgReady(ok);
  setAccessDenylistPgReady(ok);
  setVacationReminderLogsPgReady(ok);
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
        setAdminNotificationsPgReady(await importAdminNotifications());
        const coreOk = await importCore();
        setCorePgReady(coreOk);
        setAccessDenylistPgReady(await importAccessDenylist(coreOk));
        setVacationsPgReady(await importVacations());
        setVacationReminderLogsPgReady(await importReminderLogs());
      })
      .catch((err) => {
        disableDb('миграции упали');
        setAllPgReady(false);
        console.error('[db] миграции упали — DB выключена до рестарта, JSON работает:', err?.message || err);
      });
  }, 0);
});
