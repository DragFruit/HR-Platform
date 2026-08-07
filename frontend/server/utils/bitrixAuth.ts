import type { SessionUser } from './credentials';
import { fetchCurrentBitrixUser, formatBitrixUserName, bitrixRestAll, type BitrixDepartment, type BitrixUser } from './bitrixClient';
import {
  departmentHeadIds,
  resolveLoginAuthRole,
  syncEmployeesFromBitrix
} from './bitrixSync';
import { isAccessRevokedForIdentity } from './employeeAccessDenylist';

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

  const email = String(current.EMAIL || '').trim().toLowerCase();
  if (
    await isAccessRevokedForIdentity({
      id: userId,
      bitrix_user_id: userId,
      email
    })
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Доступ закрыт: сотрудник удалён из справочника Vibe'
    });
  }

  const heads = departmentHeadIds(departments);

  // Только обновляет уже заведённых в справочнике — новых из Bitrix не добавляет.
  await syncEmployeesFromBitrix(accessToken);
  const role = await resolveLoginAuthRole(userId, accessToken, heads);
  if (!role) {
    throw createError({
      statusCode: 403,
      statusMessage:
        'Нет доступа к Vibe: вас нет в справочнике сотрудников. Экстранет и внешние пользователи Bitrix не допускаются — обратитесь к HR.'
    });
  }

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
