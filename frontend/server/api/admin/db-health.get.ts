import { getDbDisabledReason, getSql, isDbEnabled } from '../../db/client';
import { requireRole } from '../../utils/requireRole';
import { getUserNotificationsBackend } from '../../utils/userNotificationsStore';
import { getAccessDenylistBackend, getCoreBackend } from '../../utils/coreStore';
import { getAdminNotificationsBackend } from '../../utils/adminNotificationsStore';
import { getVacationReminderLogsBackend } from '../../utils/vacationReminderLogsBackend';
import { getVacationsBackend } from '../../utils/vacationsStore';
import { getProfileBackends } from '../../utils/profileStore';
import { getIdeasBackend } from '../../utils/ideasStore';
import { getKnowledgeBackend } from '../../utils/knowledgeArticlesStore';
import { pitStopFile } from '../../utils/pitStopStore';
import { pitStopRaceFile } from '../../utils/pitStopRaceStore';
import { surveysFile } from '../../utils/surveysStore';
import { surveyResponsesFile } from '../../utils/surveyResponsesStore';
import { surveyStartsFile } from '../../utils/surveyStartsStore';
import { surveyVisitsFile } from '../../utils/surveyVisitsStore';
import { adaptationStateFile } from '../../utils/adaptationStore';
import { adaptationAssignmentsFile, adaptationScenariosFile } from '../../utils/adaptationScenarios';
import { vpnKeysFile } from '../../utils/vpnKeysStore';

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
    vacationReminders: await getVacationReminderLogsBackend(),
    ...(await getProfileBackends()),
    ideas: await getIdeasBackend(),
    knowledge: await getKnowledgeBackend(),
    pitStop: await pitStopFile.backend(),
    pitStopRace: await pitStopRaceFile.backend(),
    surveys: await surveysFile.backend(),
    surveyResponses: await surveyResponsesFile.backend(),
    surveyStarts: await surveyStartsFile.backend(),
    surveyVisits: await surveyVisitsFile.backend(),
    adaptationState: await adaptationStateFile.backend(),
    adaptationScenarios: await adaptationScenariosFile.backend(),
    adaptationAssignments: await adaptationAssignmentsFile.backend(),
    vpnKeys: await vpnKeysFile.backend()
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
