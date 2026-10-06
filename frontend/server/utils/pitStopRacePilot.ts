import type { SessionUser } from './credentials';
import {
  findEmployeeForSession,
  readEmployees,
  type ServerEmployee
} from './employeesStore';

/** Фамилия + инициал имени: «Шашин Д.» */
export function formatRacePilotName(fullName: string): string {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'Сотрудник';
  if (parts.length === 1) return parts[0]!;
  const last = parts[0]!;
  const firstInitial = parts[1]!.charAt(0).toUpperCase();
  return `${last} ${firstInitial}.`;
}

export function findEmployeeByRaceUserId(
  employees: ServerEmployee[],
  userId: number
): ServerEmployee | null {
  if (!userId) return null;
  return (
    employees.find((e) => e.platform_user_id === userId) ??
    employees.find((e) => e.bitrix_user_id === userId) ??
    employees.find((e) => e.id === userId) ??
    null
  );
}

/** Имя/отдел для записи круга: справочник по сессии, иначе session. */
export async function racePilotFromSession(
  session: SessionUser
): Promise<{ name: string; department: string }> {
  const emp = await findEmployeeForSession(session);
  if (emp) {
    return {
      name: formatRacePilotName(emp.name),
      department: emp.department?.trim() || session.department || ''
    };
  }
  return {
    name: formatRacePilotName(session.name || 'Сотрудник'),
    department: session.department || ''
  };
}

/** Подпись пилота в лидерборде: справочник по userId, иначе сохранённое имя. */
export async function racePilotLabelsByUserId(
  userIds: number[]
): Promise<Map<number, { name: string; department: string }>> {
  const employees = await readEmployees();
  const map = new Map<number, { name: string; department: string }>();
  for (const userId of userIds) {
    const emp = findEmployeeByRaceUserId(employees, userId);
    if (!emp) continue;
    map.set(userId, {
      name: formatRacePilotName(emp.name),
      department: emp.department?.trim() || ''
    });
  }
  return map;
}
