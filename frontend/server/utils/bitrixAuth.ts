import type { SessionUser } from './credentials';
import { fetchCurrentBitrixUser, formatBitrixUserName, bitrixRestAll, type BitrixDepartment, type BitrixUser } from './bitrixClient';
import {
  departmentHeadIds,
  resolveLoginAuthRole,
  syncEmployeesFromBitrix
} from './bitrixSync';

function primaryDepartmentName(user: BitrixUser, departments: BitrixDepartment[]): string {
  const raw = user.UF_DEPARTMENT;
  if (!Array.isArray(raw) || raw.length === 0) return '';
  const deptId = Number(raw[0]);
  const dept = departments.find((item) => Number(item.ID) === deptId);
  return String(dept?.NAME || '').trim();
}

export async function loginSessionFromBitrix(accessToken: string): Promise<SessionUser> {
  const [current, departments] = await Promise.all([
    fetchCurrentBitrixUser(accessToken),
    bitrixRestAll<BitrixDepartment>(
      'department.get',
      { select: ['ID', 'NAME', 'UF_HEAD', 'PARENT'] },
      accessToken
    )
  ]);

  const userId = Number(current.ID);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw createError({ statusCode: 502, statusMessage: 'Bitrix: не удалось определить пользователя' });
  }

  const heads = departmentHeadIds(departments);

  await syncEmployeesFromBitrix(accessToken);
  const role = await resolveLoginAuthRole(userId, accessToken, heads);

  const email = String(current.EMAIL || '').trim().toLowerCase();
  if (!email) {
    throw createError({ statusCode: 403, statusMessage: 'В профиле Битрикс не указан email' });
  }

  return {
    id: userId,
    bitrix_user_id: userId,
    name: formatBitrixUserName(current) || email,
    email,
    role,
    department: primaryDepartmentName(current, departments),
    auth_source: 'bitrix'
  };
}
