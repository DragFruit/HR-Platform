import type { AuthRole } from './credentials';
import type { ServerEmployee } from './employeesStore';
import { readEmployees, writeEmployees } from './employeesStore';
import {
  bitrixFetchAll,
  bitrixRest,
  bitrixRestAll,
  formatBitrixUserName,
  type BitrixDepartment,
  type BitrixUser
} from './bitrixClient';
import { getBitrixConfig, isBitrixWebhookConfigured, parseGroupIds } from './bitrixConfig';

type BitrixUserRow = BitrixUser & { ID: string };

function toNumberId(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function accountRoleFromAuthRole(role: AuthRole): string {
  if (role === 'admin') return 'admin';
  if (role === 'hr') return 'hr';
  if (role === 'manager') return 'manager';
  return 'employee';
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

export type BitrixSyncResult = {
  total: number;
  created: number;
  updated: number;
  keptManual: number;
};

export async function syncEmployeesFromBitrix(accessToken?: string): Promise<BitrixSyncResult> {
  const [users, departments, existing] = await Promise.all([
    bitrixFetchAll<BitrixUserRow>(
      'user.get',
      {
        filter: { ACTIVE: true },
        select: [
          'ID',
          'NAME',
          'LAST_NAME',
          'SECOND_NAME',
          'EMAIL',
          'WORK_POSITION',
          'DATE_REGISTER',
          'UF_DEPARTMENT'
        ]
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

  let created = 0;
  let updated = 0;
  const synced: ServerEmployee[] = users
    .map((user) => {
      const bitrixId = toNumberId(user.ID);
      if (!bitrixId) return null;

      const deptId = primaryDepartmentId(user);
      const department = deptId ? deptNames.get(deptId) || '' : '';
      const headId = deptId ? deptHeads.get(deptId) : null;
      const manager = headId ? userNames.get(headId) || '' : '';
      const prev = existingByBitrixId.get(bitrixId);
      if (prev) updated += 1;
      else created += 1;

      return {
        id: bitrixId,
        bitrix_user_id: bitrixId,
        name: formatBitrixUserName(user) || prev?.name || `Сотрудник ${bitrixId}`,
        title: String(user.WORK_POSITION || '').trim() || prev?.title || '',
        department: department || prev?.department || '',
        manager: manager || prev?.manager || '',
        hired_at: String(user.DATE_REGISTER || '').slice(0, 10) || prev?.hired_at || new Date().toISOString().slice(0, 10),
        platform_user_id: bitrixId,
        email: String(user.EMAIL || '').trim().toLowerCase() || prev?.email || '',
        account_role: prev?.account_role || 'employee'
      } satisfies ServerEmployee;
    })
    .filter((row): row is ServerEmployee => row !== null);

  const manualOnly = existing.filter((row) => !row.bitrix_user_id);

  await writeEmployees([...synced, ...manualOnly]);

  return {
    total: synced.length,
    created,
    updated,
    keptManual: manualOnly.length
  };
}

export async function applyRoleToSyncedEmployee(userId: number, role: AuthRole): Promise<void> {
  const list = await readEmployees();
  const idx = list.findIndex((row) => row.bitrix_user_id === userId || row.platform_user_id === userId);
  if (idx === -1) return;
  list[idx] = { ...list[idx], account_role: accountRoleFromAuthRole(role) };
  await writeEmployees(list);
}

export { departmentHeadIds };
