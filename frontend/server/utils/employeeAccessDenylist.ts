import type { ServerEmployee } from './employeesStore';
import type { CoreWriteContext } from '../core/types';
import type { AccessDenylistEntry } from '../core/accessDenylistStore';
import { accessDenylistRepo } from './coreStore';
import {
  normalizeManagerNameKey,
  readManagerAssignments,
  writeManagerAssignments
} from './employeeManagersStore';
import { readOrgStructure, writeOrgStructure } from './orgStructureStore';
import { readVpnKeys, removeVpnKeysByIds } from './vpnKeysStore';
import { deleteWgClient, panelForKind } from './wgEasyClient';
import { createVpnPeerDeleteFailedNotification } from './adminNotificationsStore';
import { deleteUserNotificationsForRecipients } from './userNotificationsStore';
import { removeUserAvatars } from './userAvatarsStore';
import { purgeAdaptationProgressForEmployee } from './adaptationStore';
import { removeAdaptationAssignmentForEmployee } from './adaptationScenarios';
import { deleteProfileActivityForEmployee } from './profileActivityStore';
import { purgeVacationsForEmployeeName } from './vacationsStore';

export type { AccessDenylistEntry } from '../core/accessDenylistStore';

const DAY_MS = 24 * 60 * 60 * 1000;
const AVATAR_RETENTION_MS = 14 * DAY_MS;
const YEAR_RETENTION_MS = 365 * DAY_MS;

/**
 * Стоп-лист (этап 5): DB_CORE=1 + DATABASE_URL → core.access_denylist (кэш процесса, при сбое базы —
 * последний прочитанный список или JSON-зеркало), иначе server/data/employee-access-denylist.json.
 */
export async function readAccessDenylist(): Promise<AccessDenylistEntry[]> {
  return (await accessDenylistRepo()).read();
}

/** Одна и та же запись отзыва в снимке и в свежем списке. */
const revocationIdentity = (e: AccessDenylistEntry) =>
  JSON.stringify([e.revoked_at ?? null, e.employee_id ?? null, e.bitrix_user_id ?? null, e.platform_user_id ?? null, e.email ?? null]);

/** Правка стоп-листа: строго по очереди, читается внутри той же операции (без гонок). */
async function mutateAccessDenylist(
  fn: (entries: AccessDenylistEntry[]) => AccessDenylistEntry[] | null,
  ctx: CoreWriteContext
) {
  await (await accessDenylistRepo()).mutate(fn, ctx);
}

function normEmail(email: string | undefined | null) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function namesMatch(a: string | undefined | null, b: string | undefined | null) {
  const left = normalizeManagerNameKey(String(a || ''));
  const right = normalizeManagerNameKey(String(b || ''));
  return Boolean(left && right && left === right);
}

function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

function collectUserIds(
  emp: Pick<ServerEmployee, 'id' | 'bitrix_user_id' | 'platform_user_id'>
): number[] {
  const ids = new Set<number>();
  if (Number.isFinite(emp.id) && emp.id > 0) ids.add(emp.id);
  const bitrixId = Number(emp.bitrix_user_id ?? emp.platform_user_id ?? 0);
  if (bitrixId > 0) ids.add(bitrixId);
  if (emp.platform_user_id && emp.platform_user_id > 0) ids.add(emp.platform_user_id);
  return [...ids];
}

export function isSessionDenied(
  entries: AccessDenylistEntry[],
  session: { bitrix_user_id?: number | null; id?: number; email?: string }
): boolean {
  const bitrixId = Number(session.bitrix_user_id ?? session.id);
  const email = normEmail(session.email);
  return entries.some((row) => {
    if (bitrixId > 0 && Number(row.bitrix_user_id) === bitrixId) return true;
    if (bitrixId > 0 && Number(row.platform_user_id) === bitrixId) return true;
    if (email && normEmail(row.email) === email) return true;
    return false;
  });
}

/** Сотрудник в denylist — нельзя держать в справочнике и возвращать синкам/деплоем. */
export function isRosterEmployeeDenied(
  entries: AccessDenylistEntry[],
  emp: {
    id?: number;
    bitrix_user_id?: number | null;
    platform_user_id?: number | null;
    email?: string;
    name?: string;
  }
): boolean {
  const bitrixId = Number(emp.bitrix_user_id ?? emp.platform_user_id ?? 0);
  const email = normEmail(emp.email);
  return entries.some((row) => {
    if (emp.id && Number(row.employee_id) === emp.id) return true;
    if (bitrixId > 0 && Number(row.bitrix_user_id) === bitrixId) return true;
    if (bitrixId > 0 && Number(row.platform_user_id) === bitrixId) return true;
    if (email && normEmail(row.email) === email) return true;
    if (namesMatch(row.name, emp.name)) return true;
    return false;
  });
}

export async function isBitrixUserAccessRevoked(bitrixUserId: number): Promise<boolean> {
  if (!Number.isFinite(bitrixUserId) || bitrixUserId <= 0) return false;
  const entries = await readAccessDenylist();
  return entries.some(
    (row) =>
      Number(row.bitrix_user_id) === bitrixUserId || Number(row.platform_user_id) === bitrixUserId
  );
}

export async function isAccessRevokedForIdentity(identity: {
  bitrix_user_id?: number | null;
  id?: number;
  email?: string;
}): Promise<boolean> {
  const entries = await readAccessDenylist();
  return isSessionDenied(entries, identity);
}

async function revokeVpnPeersForEmployee(
  emp: Pick<ServerEmployee, 'id' | 'name' | 'bitrix_user_id' | 'platform_user_id'>,
  userIds: number[]
): Promise<void> {
  const keys = await readVpnKeys();
  const owned = keys.filter((k) => userIds.includes(k.userId));
  const failed: { name: string; panel: string; error: string }[] = [];

  for (const key of owned) {
    const panel = panelForKind(key.kind);
    try {
      await deleteWgClient(panel, key.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ name: key.clientName || key.id, panel, error: message });
      console.warn('[employeeAccessDenylist] VPN peer delete failed:', key.id, message);
    }
  }

  if (owned.length) {
    await removeVpnKeysByIds(owned.map((k) => k.id));
  }

  if (failed.length) {
    await createVpnPeerDeleteFailedNotification({
      employee_id: emp.id,
      employee_name: emp.name?.trim() || `Сотрудник ${emp.id}`,
      peer_names: failed.map((f) => f.name),
      panel: [...new Set(failed.map((f) => f.panel))].join(', '),
      error: failed.map((f) => `${f.name}: ${f.error}`).join('; ').slice(0, 500)
    });
  }
}

async function cascadeImmediateAfterRevocation(
  emp: Pick<ServerEmployee, 'id' | 'name' | 'email' | 'bitrix_user_id' | 'platform_user_id'>
): Promise<void> {
  const userIds = collectUserIds(emp);

  const assignments = await readManagerAssignments();
  const idKey = String(emp.id);
  const nameKey = normalizeManagerNameKey(emp.name);
  let managersChanged = false;
  if (assignments.byId[idKey]) {
    delete assignments.byId[idKey];
    managersChanged = true;
  }
  if (nameKey && assignments.byName[nameKey]) {
    delete assignments.byName[nameKey];
    managersChanged = true;
  }
  if (managersChanged) await writeManagerAssignments(assignments, { reason: 'access-revoked' });

  try {
    await revokeVpnPeersForEmployee(emp, userIds);
  } catch (err) {
    console.warn('[employeeAccessDenylist] VPN cascade failed:', err);
    await createVpnPeerDeleteFailedNotification({
      employee_id: emp.id,
      employee_name: emp.name?.trim() || `Сотрудник ${emp.id}`,
      peer_names: ['(все ключи сотрудника)'],
      error: err instanceof Error ? err.message : String(err)
    }).catch(() => {});
  }

  try {
    await deleteUserNotificationsForRecipients(userIds);
  } catch (err) {
    console.warn('[employeeAccessDenylist] notifications cascade failed:', err);
  }

  try {
    await removeAdaptationAssignmentForEmployee(emp.id);
    await purgeAdaptationProgressForEmployee({
      employee_id: emp.id,
      platform_user_ids: userIds
    });
  } catch (err) {
    console.warn('[employeeAccessDenylist] adaptation cascade failed:', err);
  }

  try {
    await deleteProfileActivityForEmployee({
      employee_id: emp.id,
      platform_user_ids: userIds
    });
  } catch (err) {
    console.warn('[employeeAccessDenylist] profile-activity cascade failed:', err);
  }

  try {
    const org = await readOrgStructure();
    let orgChanged = false;
    for (const exec of org.executives) {
      if (namesMatch(exec.person, emp.name)) {
        exec.person = '';
        orgChanged = true;
      }
    }
    for (const unit of org.units) {
      if (namesMatch(unit.head, emp.name)) {
        unit.head = '';
        orgChanged = true;
      }
      if (Array.isArray(unit.members) && unit.members.length) {
        const nextMembers = unit.members.filter((m) => !namesMatch(m?.name, emp.name));
        if (nextMembers.length !== unit.members.length) {
          unit.members = nextMembers;
          orgChanged = true;
        }
      }
    }
    if (orgChanged) await writeOrgStructure(org, { reason: 'access-revoked' });
  } catch (err) {
    console.warn('[employeeAccessDenylist] org cascade failed:', err);
  }
}

/**
 * Отложенные чистки по срокам хранения (аватар 14д, отпуска 1г).
 * Вызывается при проверке сессии / записи справочника.
 */
export async function purgeExpiredRevocationArtifacts(): Promise<void> {
  const entries = await readAccessDenylist();
  if (!entries.length) return;

  const now = Date.now();
  /** Какие записи (по снимку) дочищены — флаги ставим потом, на свежем списке. */
  const done: { row: AccessDenylistEntry; avatar: boolean; vacations: boolean }[] = [];

  for (const row of entries) {
    const mark = { row: { ...row }, avatar: false, vacations: false };
    const userIds = [
      Number(row.employee_id || 0),
      Number(row.bitrix_user_id || 0),
      Number(row.platform_user_id || 0)
    ].filter((id) => id > 0);

    if (!row.avatar_purged && row.avatar_purge_at && new Date(row.avatar_purge_at).getTime() <= now) {
      try {
        await removeUserAvatars(userIds);
        mark.avatar = true;
      } catch (err) {
        console.warn('[employeeAccessDenylist] avatar purge failed:', err);
      }
    }

    if (
      !row.vacations_purged &&
      row.vacations_purge_at &&
      new Date(row.vacations_purge_at).getTime() <= now &&
      row.name
    ) {
      try {
        await purgeVacationsForEmployeeName(row.name);
        mark.vacations = true;
      } catch (err) {
        console.warn('[employeeAccessDenylist] vacations purge failed:', err);
      }
    }
    if (mark.avatar || mark.vacations) done.push(mark);
  }

  if (!done.length) return;
  await mutateAccessDenylist(
    (current) => {
      let changed = false;
      for (const entry of current) {
        const hit = done.find((d) => revocationIdentity(d.row) === revocationIdentity(entry));
        if (!hit) continue;
        if (hit.avatar && !entry.avatar_purged) {
          entry.avatar_purged = true;
          changed = true;
        }
        if (hit.vacations && !entry.vacations_purged) {
          entry.vacations_purged = true;
          changed = true;
        }
      }
      return changed ? current : null;
    },
    { reason: 'retention-purge' }
  );
}

/** Записать отзыв доступа (идемпотентно по bitrix_user_id / email). ctx — кто и почему (аудит в Postgres). */
export async function revokeEmployeeAccess(
  emp: Pick<
    ServerEmployee,
    'id' | 'name' | 'email' | 'bitrix_user_id' | 'platform_user_id' | 'account_role'
  >,
  reason = 'removed-from-roster',
  ctx: CoreWriteContext = {}
): Promise<void> {
  if (emp.account_role === 'admin') return;

  const bitrixId = Number(emp.bitrix_user_id ?? emp.platform_user_id ?? 0) || null;
  const email = normEmail(emp.email);
  await mutateAccessDenylist(
    (entries) => {
      const filtered = entries.filter((row) => {
        if (bitrixId && Number(row.bitrix_user_id) === bitrixId) return false;
        if (bitrixId && Number(row.platform_user_id) === bitrixId) return false;
        if (email && normEmail(row.email) === email) return false;
        if (row.employee_id === emp.id) return false;
        return true;
      });

      const revokedAt = new Date().toISOString();
      filtered.push({
        bitrix_user_id: bitrixId,
        platform_user_id: emp.platform_user_id ?? bitrixId,
        email: email || undefined,
        name: emp.name?.trim() || undefined,
        employee_id: emp.id,
        revoked_at: revokedAt,
        reason,
        avatar_purge_at: addMs(revokedAt, AVATAR_RETENTION_MS),
        vacations_purge_at: addMs(revokedAt, YEAR_RETENTION_MS),
        wallet_purge_at: addMs(revokedAt, YEAR_RETENTION_MS),
        purchases_purge_at: addMs(revokedAt, YEAR_RETENTION_MS),
        avatar_purged: false,
        vacations_purged: false
      });
      return filtered;
    },
    { actorEmployeeId: ctx.actorEmployeeId ?? null, reason: ctx.reason ? `${reason}:${ctx.reason}` : reason }
  );
  await cascadeImmediateAfterRevocation(emp);
}

/** Снять отзыв при повторном добавлении в справочник. */
export async function clearAccessRevocationForEmployee(
  emp: Pick<ServerEmployee, 'bitrix_user_id' | 'platform_user_id' | 'email' | 'id'>,
  ctx: CoreWriteContext = {}
): Promise<void> {
  const bitrixId = Number(emp.bitrix_user_id ?? emp.platform_user_id ?? 0) || null;
  const email = normEmail(emp.email);
  await mutateAccessDenylist(
    (entries) => {
      const next = entries.filter((row) => {
        if (bitrixId && Number(row.bitrix_user_id) === bitrixId) return false;
        if (bitrixId && Number(row.platform_user_id) === bitrixId) return false;
        if (email && normEmail(row.email) === email) return false;
        if (row.employee_id === emp.id) return false;
        return true;
      });
      return next.length !== entries.length ? next : null;
    },
    { actorEmployeeId: ctx.actorEmployeeId ?? null, reason: ctx.reason ? `re-added:${ctx.reason}` : 're-added' }
  );
}
