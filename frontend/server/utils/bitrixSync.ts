import type { AuthRole } from './credentials';
import type { ServerEmployee } from './employeesStore';
import { upsertBitrixFieldNotification, normalizeNotificationText } from './adminNotificationsStore';
import { employeeIdentityKeys, readEmployees, writeEmployees } from './employeesStore';
import {
  bitrixFetchAll,
  bitrixRest,
  bitrixRestAll,
  formatBitrixUserName,
  type BitrixDepartment,
  type BitrixUser
} from './bitrixClient';
import { getBitrixConfig, isBitrixWebhookConfigured, parseGroupIds } from './bitrixConfig';
import { isBitrixUserAccessRevoked } from './employeeAccessDenylist';

type BitrixUserRow = BitrixUser & { ID: string };

function toNumberId(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function authRoleFromAccountRole(accountRole?: string): AuthRole | null {
  const role = String(accountRole || '').trim();
  if (role === 'admin' || role === 'hr' || role === 'manager' || role === 'employee') return role;
  return null;
}

export async function resolveAuthRoleFromEmployees(userId: number): Promise<AuthRole | null> {
  const employee = await findEmployeeByBitrixUserId(userId);
  return authRoleFromAccountRole(employee?.account_role);
}

/** Сотрудник есть в справочнике Vibe (не экстранет / не «просто ACTIVE в Bitrix»). */
export async function findEmployeeByBitrixUserId(userId: number): Promise<ServerEmployee | null> {
  if (!Number.isFinite(userId) || userId <= 0) return null;
  const list = await readEmployees();
  return (
    list.find(
      (row) => row.bitrix_user_id === userId || row.platform_user_id === userId || row.id === userId
    ) ?? null
  );
}

export async function isBitrixUserInRoster(userId: number): Promise<boolean> {
  return Boolean(await findEmployeeByBitrixUserId(userId));
}

/**
 * Роль для входа: только если пользователь уже в справочнике.
 * Без записи в employees.json — null (экстранет / практиканты / гости Bitrix).
 */
export async function resolveLoginAuthRole(
  userId: number,
  accessToken: string,
  departmentHeads: Set<number>
): Promise<AuthRole | null> {
  const employee = await findEmployeeByBitrixUserId(userId);
  if (!employee) return null;

  const fromEmployees = authRoleFromAccountRole(employee.account_role);
  if (fromEmployees) return fromEmployees;
  return resolveBitrixUserRole(userId, accessToken, departmentHeads);
}

async function fetchUsersInGroups(groupIds: number[], accessToken: string): Promise<Set<number>> {
  const ids = new Set<number>();
  for (const groupId of groupIds) {
    const users = await bitrixRestAll<BitrixUserRow>(
      'user.get',
      {
        filter: { ACTIVE: true, GROUPS_ID: groupId },
        select: ['ID']
      },
      accessToken
    );
    users.forEach((user) => {
      const id = toNumberId(user.ID);
      if (id) ids.add(id);
    });
  }
  return ids;
}

async function isBitrixAdmin(accessToken: string): Promise<boolean> {
  try {
    const result = await bitrixRest<boolean>('user.admin', {}, accessToken);
    return Boolean(result);
  } catch {
    return false;
  }
}

export async function resolveBitrixUserRole(
  userId: number,
  accessToken: string,
  departmentHeadIds: Set<number>
): Promise<AuthRole> {
  const { bitrixAdminGroupIds, bitrixHrGroupIds, bitrixManagerGroupIds } = getBitrixConfig();
  const adminGroups = parseGroupIds(bitrixAdminGroupIds);
  const hrGroups = parseGroupIds(bitrixHrGroupIds);
  const managerGroups = parseGroupIds(bitrixManagerGroupIds);

  if (!adminGroups.length) adminGroups.push(1);

  if (await isBitrixAdmin(accessToken)) return 'admin';

  const [adminMembers, hrMembers, managerMembers] = await Promise.all([
    fetchUsersInGroups(adminGroups, accessToken),
    hrGroups.length ? fetchUsersInGroups(hrGroups, accessToken) : Promise.resolve(new Set<number>()),
    managerGroups.length ? fetchUsersInGroups(managerGroups, accessToken) : Promise.resolve(new Set<number>())
  ]);

  if (adminMembers.has(userId)) return 'admin';
  if (hrMembers.has(userId)) return 'hr';
  if (departmentHeadIds.has(userId) || managerMembers.has(userId)) return 'manager';
  return 'employee';
}

function primaryDepartmentId(user: BitrixUserRow): number | null {
  const raw = user.UF_DEPARTMENT;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return toNumberId(raw[0]);
}

function departmentNameMap(departments: BitrixDepartment[]): Map<number, string> {
  const map = new Map<number, string>();
  departments.forEach((dept) => {
    const id = toNumberId(dept.ID);
    if (id) map.set(id, String(dept.NAME || '').trim() || `Отдел ${id}`);
  });
  return map;
}

function departmentHeadMap(departments: BitrixDepartment[]): Map<number, number> {
  const map = new Map<number, number>();
  departments.forEach((dept) => {
    const deptId = toNumberId(dept.ID);
    const headId = toNumberId(dept.UF_HEAD);
    if (deptId && headId) map.set(deptId, headId);
  });
  return map;
}

function departmentHeadIds(departments: BitrixDepartment[]): Set<number> {
  const ids = new Set<number>();
  departments.forEach((dept) => {
    const headId = toNumberId(dept.UF_HEAD);
    if (headId) ids.add(headId);
  });
  return ids;
}

const BITRIX_USER_SELECT = [
  'ID',
  'NAME',
  'LAST_NAME',
  'EMAIL',
  'WORK_POSITION',
  'DATE_REGISTER',
  'UF_DEPARTMENT'
] as const;

type BitrixFieldChange = {
  field: 'name' | 'title';
  platform_value: string;
  bitrix_value: string;
};

function collectBitrixFieldChanges(
  prev: ServerEmployee,
  bitrixName: string,
  bitrixTitle: string
): BitrixFieldChange[] {
  const fieldChanges: BitrixFieldChange[] = [];
  if (bitrixName && normalizeNotificationText(prev.name) !== normalizeNotificationText(bitrixName)) {
    fieldChanges.push({ field: 'name', platform_value: prev.name, bitrix_value: bitrixName });
  }
  if (normalizeNotificationText(prev.title) !== normalizeNotificationText(bitrixTitle)) {
    fieldChanges.push({ field: 'title', platform_value: prev.title, bitrix_value: bitrixTitle });
  }
  return fieldChanges;
}

async function upsertEmployeeBitrixNotifications(
  prev: ServerEmployee,
  bitrixId: number,
  bitrixName: string,
  bitrixTitle: string
): Promise<number> {
  let created = 0;
  for (const change of collectBitrixFieldChanges(prev, bitrixName, bitrixTitle)) {
    const notification = await upsertBitrixFieldNotification({
      employee_id: prev.id,
      bitrix_user_id: bitrixId,
      employee_name: prev.name,
      ...change
    });
    if (notification) created += 1;
  }
  return created;
}

async function fetchBitrixUserById(
  bitrixId: number,
  accessToken?: string
): Promise<BitrixUserRow | null> {
  const rows = await bitrixFetchAll<BitrixUserRow>(
    'user.get',
    {
      filter: { ID: bitrixId },
      select: [...BITRIX_USER_SELECT]
    },
    accessToken
  );
  return rows[0] ?? null;
}

export type BitrixSyncResult = {
  total: number;
  created: number;
  updated: number;
  keptManual: number;
  keptRosterOnly: number;
  notificationsCreated: number;
};

export type BitrixSyncOptions = {
  /** Добавлять новых людей из Bitrix, которых нет в справочнике (ручной импорт). */
  importNew?: boolean;
};

export async function syncEmployeesFromBitrix(
  accessToken?: string,
  options: BitrixSyncOptions = {}
): Promise<BitrixSyncResult> {
  const [users, departments, existing] = await Promise.all([
    bitrixFetchAll<BitrixUserRow>(
      'user.get',
      {
        filter: { ACTIVE: true },
        select: [...BITRIX_USER_SELECT]
      },
      accessToken
    ),
    bitrixFetchAll<BitrixDepartment>(
      'department.get',
      { select: ['ID', 'NAME', 'UF_HEAD', 'PARENT'] },
      accessToken
    ),
    readEmployees()
  ]);

  const deptNames = departmentNameMap(departments);
  const deptHeads = departmentHeadMap(departments);
  const userNames = new Map<number, string>();
  users.forEach((user) => {
    const id = toNumberId(user.ID);
    if (id) userNames.set(id, formatBitrixUserName(user));
  });

  const existingByBitrixId = new Map<number, ServerEmployee>();
  existing.forEach((row) => {
    const bitrixId = row.bitrix_user_id ?? (row.platform_user_id && row.id === row.platform_user_id ? row.id : null);
    if (bitrixId) existingByBitrixId.set(bitrixId, row);
  });

  const importNew = options.importNew === true;

  let created = 0;
  let updated = 0;
  let notificationsCreated = 0;
  const synced: ServerEmployee[] = [];
  for (const user of users) {
    const bitrixId = toNumberId(user.ID);
    if (!bitrixId) continue;
    if (await isBitrixUserAccessRevoked(bitrixId)) continue;

    const prev = existingByBitrixId.get(bitrixId);
    if (!prev && !importNew) continue;

    const deptId = primaryDepartmentId(user);
    const department = deptId ? deptNames.get(deptId) || '' : '';
    const headId = deptId ? deptHeads.get(deptId) : null;
    const manager = headId ? userNames.get(headId) || '' : '';
    const bitrixName = formatBitrixUserName(user) || '';
    const bitrixTitle = String(user.WORK_POSITION || '').trim();
    if (prev) {
      updated += 1;
      notificationsCreated += await upsertEmployeeBitrixNotifications(
        prev,
        bitrixId,
        bitrixName,
        bitrixTitle
      );

      synced.push({
        ...prev,
        bitrix_user_id: bitrixId,
        platform_user_id: prev.platform_user_id ?? bitrixId,
        email: prev.email?.trim() || String(user.EMAIL || '').trim().toLowerCase() || ''
      });
      continue;
    }

    if (!importNew) continue;

    created += 1;
    synced.push({
      id: bitrixId,
      bitrix_user_id: bitrixId,
      name: formatBitrixUserName(user) || `Сотрудник ${bitrixId}`,
      title: String(user.WORK_POSITION || '').trim(),
      department,
      manager,
      hired_at: String(user.DATE_REGISTER || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      platform_user_id: bitrixId,
      email: String(user.EMAIL || '').trim().toLowerCase(),
      account_role: ''
    });
  }

  const syncedIds = new Set(synced.map((row) => row.bitrix_user_id).filter((id): id is number => id != null));
  const keptRosterOnly = existing.filter(
    (row) => row.bitrix_user_id && !syncedIds.has(row.bitrix_user_id)
  );

  if (keptRosterOnly.length > 0) {
    const bitrixLinkedCount = existing.filter((row) => row.bitrix_user_id).length;
    if (users.length < bitrixLinkedCount) {
      console.warn(
        `[bitrixSync] Bulk user.get: ${users.length} users, ${bitrixLinkedCount} employees with bitrix_user_id; ` +
          `checking ${keptRosterOnly.length} individually`
      );
    }

    for (const prev of keptRosterOnly) {
      const bitrixId = prev.bitrix_user_id;
      if (!bitrixId) continue;
      try {
        const user = await fetchBitrixUserById(bitrixId, accessToken);
        if (!user) continue;
        const bitrixName = formatBitrixUserName(user) || '';
        const bitrixTitle = String(user.WORK_POSITION || '').trim();
        notificationsCreated += await upsertEmployeeBitrixNotifications(
          prev,
          bitrixId,
          bitrixName,
          bitrixTitle
        );
      } catch (err) {
        console.warn(`[bitrixSync] user.get ID=${bitrixId} failed:`, err);
      }
    }
  }

  const coveredKeys = new Set<string>();
  [...synced, ...keptRosterOnly].forEach((row) => {
    employeeIdentityKeys(row).forEach((key) => coveredKeys.add(key));
  });

  const manualOnly = existing.filter((row) => {
    if (row.bitrix_user_id) return false;
    const keys = employeeIdentityKeys(row);
    if (keys.some((key) => coveredKeys.has(key))) return false;
    return true;
  });

  await writeEmployees([...synced, ...keptRosterOnly, ...manualOnly], { preserveManagers: true });

  return {
    total: synced.length + keptRosterOnly.length + manualOnly.length,
    created,
    updated,
    keptManual: manualOnly.length,
    keptRosterOnly: keptRosterOnly.length,
    notificationsCreated
  };
}

export { departmentHeadIds };
