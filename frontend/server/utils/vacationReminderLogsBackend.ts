import { getDb } from '../db/client';
import {
  createJsonReminderLogRepo,
  createPgReminderLogRepo,
  type ReminderLogKind,
  type ReminderLogRecord,
  type ReminderLogRepo
} from '../vacations/reminderLogs';
import { vacationsDbFlag } from './vacationsStore';

/**
 * Где живут журналы напоминаний об отпусках (этап 5): DB_VACATIONS=1 + DATABASE_URL → Postgres
 * (vacations.pre_reminders / vacations.manager_month_reminders), иначе JSON-файлы, как раньше.
 * Готовность — своя, не общая с отпусками: если импорт журналов упал, отпуска (уже живущие
 * в Postgres с этапа 4) не откатываются на устаревший vacations.json, а журналы остаются на файлах.
 */
let resolvePgReady!: (ok: boolean) => void;
const pgReady = new Promise<boolean>((resolve) => {
  resolvePgReady = resolve;
});

/** Вызывает плагин db-migrate после импорта журналов. */
export function setVacationReminderLogsPgReady(ok: boolean) {
  resolvePgReady(ok);
}

const pgRepos = new Map<ReminderLogKind, ReminderLogRepo<ReminderLogRecord>>();
const jsonRepos = new Map<ReminderLogKind, ReminderLogRepo<ReminderLogRecord>>();
let warnedFallback = false;

export async function vacationReminderLogRepo<R extends ReminderLogRecord>(
  kind: ReminderLogKind,
  jsonPath: () => string
): Promise<ReminderLogRepo<R>> {
  if (vacationsDbFlag()) {
    const ok = await pgReady;
    const db = ok ? getDb() : null;
    if (db) {
      if (!pgRepos.has(kind)) pgRepos.set(kind, createPgReminderLogRepo(db, kind));
      return pgRepos.get(kind) as unknown as ReminderLogRepo<R>;
    }
    if (!warnedFallback) {
      warnedFallback = true;
      console.error('[vacations] DB_VACATIONS=1, но журналы напоминаний не на Postgres — работаем на JSON');
    }
  }
  if (!jsonRepos.has(kind)) jsonRepos.set(kind, createJsonReminderLogRepo(jsonPath));
  return jsonRepos.get(kind) as unknown as ReminderLogRepo<R>;
}

export async function getVacationReminderLogsBackend(): Promise<'json' | 'postgres'> {
  return (await vacationReminderLogRepo('pre', () => '')).backend;
}
