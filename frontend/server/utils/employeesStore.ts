import { createMutationQueue } from './atomicJson';
import { coreRepo } from './coreStore';
import type { CoreWriteContext } from '../core/types';
import { dedupeEmployeeList, employeeIdentityKeys } from '../../app/utils/employeeDedupe';
import {
  mergeQaTestEmployees,
  stripQaTestEmployees
} from '../../app/data/qaTestDepartment';
import { employeeNamesMatch } from '../../app/utils/employeeName';
import { ensureEmployeeManagerIds } from '../../app/utils/employeeManagerRef';
import type { SessionUser } from './credentials';
import {
  applyManagerAssignments,
  extractManagerAssignments,
  mergeManagerAssignments,
  readManagerAssignments,
  writeManagerAssignments
} from './employeeManagersStore';
import {
  clearAccessRevocationForEmployee,
  isRosterEmployeeDenied,
  purgeExpiredRevocationArtifacts,
  readAccessDenylist,
  revokeEmployeeAccess
} from './employeeAccessDenylist';

export type ServerEmployee = {
  id: number;
  name: string;
  title: string;
  department: string;
  manager: string;
  /** id руководителя из справочника. */
  manager_id?: number | null;
  hired_at: string;
  /** День рождения: `YYYY-MM-DD` или `MM-DD`. */
  birthday?: string | null;
  platform_user_id: number | null;
  bitrix_user_id?: number | null;
  email?: string;
  account_role?: string;
  vacation_opening_balance?: number | null;
  /** Юридическое лицо работодателя (ручной ввод в админке, не из Bitrix). */
  legal_entity?: string;
  /** Форма договора: ТД, ГПХ и т.п. (ручной ввод в админке). */
  contract_form?: string;
};

/** Хранилище: server/data/employees.json или core.employees (DB_CORE=1), см. coreStore.ts. */
const enqueueEmployeesMutation = createMutationQueue();

export const defaultEmployees = (): ServerEmployee[] => [];

async function readRaw(): Promise<ServerEmployee[]> {
  return (await coreRepo()).readEmployeesRaw();
}

async function writeRaw(list: ServerEmployee[], ctx?: CoreWriteContext): Promise<void> {
  await (await coreRepo()).writeEmployeesRaw(list, ctx);
}

export function dedupeEmployees(list: ServerEmployee[]): ServerEmployee[] {
  return dedupeEmployeeList(
    list.map((row) => ({
      ...row,
      bitrix_user_id:
        row.bitrix_user_id ??
        (row.platform_user_id && row.id === row.platform_user_id ? row.id : row.bitrix_user_id ?? null)
    }))
  );
}

export { employeeIdentityKeys };

export async function readEmployees(): Promise<ServerEmployee[]> {
  const parsed = await readRaw();
  const deduped = dedupeEmployees(parsed);
  if (deduped.length !== parsed.length) {
    await writeRaw(deduped, { reason: 'dedupe' });
  }
  const assignments = await readManagerAssignments();
  const withManagers = applyManagerAssignments(deduped, assignments);
  const denylist = await readAccessDenylist();
  const withoutDenied = withManagers.filter((row) => !isRosterEmployeeDenied(denylist, row));
  // Лечим файл, если деплой/синк вернул удалённых
  if (withoutDenied.length !== withManagers.length) {
    await enqueueEmployeesMutation(async () => {
      const again = await readEmployeesRawWithoutQaMerge();
      const denylistNow = await readAccessDenylist();
      const cleaned = again.filter((row) => !isRosterEmployeeDenied(denylistNow, row));
      if (cleaned.length !== again.length) {
        await writeRaw(cleaned, { reason: 'denylist-heal' });
      }
    });
  }
  return ensureEmployeeManagerIds(mergeQaTestEmployees(withoutDenied));
}

export type WriteEmployeesOptions = CoreWriteContext & {
  /** Не обновлять overlay руководителей (синк Bitrix, импорт). */
  preserveManagers?: boolean;
};

export async function writeEmployees(
  list: ServerEmployee[],
  options: WriteEmployeesOptions = {}
): Promise<ServerEmployee[]> {
  const ctx: CoreWriteContext = { actorEmployeeId: options.actorEmployeeId, reason: options.reason };
  return enqueueEmployeesMutation(async () => {
    const previous = stripQaTestEmployees(await readEmployeesRawWithoutQaMerge());
    let normalized = dedupeEmployees(stripQaTestEmployees(list));

    const nextIds = new Set(normalized.map((row) => row.id));
    for (const prev of previous) {
      if (nextIds.has(prev.id)) continue;
      await revokeEmployeeAccess(prev, 'removed-from-roster');
    }
    const previousIds = new Set(previous.map((row) => row.id));
    for (const row of normalized) {
      if (previousIds.has(row.id)) continue;
      await clearAccessRevocationForEmployee(row);
    }

    // После clear: старые отзывы не пишем обратно в справочник
    const denylistAfter = await readAccessDenylist();
    normalized = normalized.filter((row) => !isRosterEmployeeDenied(denylistAfter, row));

    void purgeExpiredRevocationArtifacts().catch(() => {});

    const currentAssignments = await readManagerAssignments();
    let mergedAssignments = currentAssignments;
    if (!options.preserveManagers) {
      const incomingAssignments = extractManagerAssignments(normalized);
      mergedAssignments = await mergeManagerAssignments(currentAssignments, incomingAssignments);
      await writeManagerAssignments(mergedAssignments, ctx);
    }
    const withManagers = applyManagerAssignments(normalized, mergedAssignments);
    await writeRaw(withManagers, ctx);
    return withManagers;
  });
}

/** Сырой список без QA-слияния — для сравнения удалений. */
async function readEmployeesRawWithoutQaMerge(): Promise<ServerEmployee[]> {
  const parsed = await readRaw();
  const deduped = dedupeEmployees(parsed);
  const assignments = await readManagerAssignments();
  return applyManagerAssignments(deduped, assignments);
}

export async function findEmployeeByPlatformUserId(userId: number): Promise<ServerEmployee | null> {
  const list = await readEmployees();
  return list.find((e) => e.platform_user_id === userId) ?? null;
}

const DEMO_HIRED_AT: Record<string, string> = {
  'alina@vbi.local': '2026-06-23',
  'katya@vbi.local': '2026-06-10',
  'vasya@vbi.local': '2026-05-01',
  'masha@vbi.local': '2026-04-15',
  'kostya@vbi.local': '2020-01-10',
  'stas@vbi.local': '2019-01-10'
};

function demoEmployeeFromSession(session: SessionUser): ServerEmployee {
  const email = session.email.toLowerCase();
  return {
    id: session.id,
    name: session.name,
    title: session.role === 'admin' ? 'HR-админ' : session.role === 'manager' ? 'Руководитель' : 'Сотрудник',
    department: session.department,
    manager: session.role === 'manager' ? 'Стас' : 'Костя',
    hired_at: DEMO_HIRED_AT[email] ?? '2026-06-01',
    platform_user_id: session.id,
    email: session.email,
    account_role: session.role
  };
}

/** Сотрудник для API адаптации: справочник, email или демо-профиль. */
export async function findEmployeeForSession(session: SessionUser): Promise<ServerEmployee | null> {
  const list = await readEmployees();
  const byPlatformId = list.find((e) => e.platform_user_id === session.id);
  if (byPlatformId) return byPlatformId;

  const bitrixId = session.bitrix_user_id ?? session.id;
  if (bitrixId > 0) {
    const byBitrix = list.find((e) => e.bitrix_user_id === bitrixId);
    if (byBitrix) return byBitrix;
  }

  const email = session.email.trim().toLowerCase();
  if (email) {
    const byEmail = list.find((e) => e.email?.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }

  if (session.auth_source === 'demo') {
    return demoEmployeeFromSession(session);
  }

  return null;
}

export async function findEmployeeById(id: number): Promise<ServerEmployee | null> {
  const list = await readEmployees();
  return list.find((e) => e.id === id) ?? null;
}

export async function findEmployeeByName(name: string): Promise<ServerEmployee | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const list = await readEmployees();
  return list.find((e) => employeeNamesMatch(e.name, trimmed)) ?? null;
}

/** Точечное обновление email (вход Vibe) без полной перезаписи справочника. */
export async function patchEmployeeEmail(
  employeeId: number,
  email: string,
  ctx: CoreWriteContext = {}
): Promise<ServerEmployee> {
  const nextEmail = email.trim().toLowerCase();
  if (!nextEmail || !nextEmail.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите корректный email' });
  }

  return enqueueEmployeesMutation(async () => {
    const list = stripQaTestEmployees(await readEmployeesRawWithoutQaMerge());
    const idx = list.findIndex((row) => row.id === employeeId);
    if (idx < 0) {
      throw createError({ statusCode: 404, statusMessage: 'Сотрудник не найден' });
    }
    const clash = list.find(
      (row) =>
        row.id !== employeeId && (row.email || '').trim().toLowerCase() === nextEmail
    );
    if (clash) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Этот логин уже занят другим сотрудником'
      });
    }
    list[idx] = { ...list[idx], email: nextEmail };
    const currentAssignments = await readManagerAssignments();
    const withManagers = applyManagerAssignments(list, currentAssignments);
    await writeRaw(withManagers, { reason: 'vibe-login-email', ...ctx });
    return withManagers[idx]!;
  });
}

/** id сотрудника текущей сессии для аудита (actor_employee_id); null — не нашли. */
export async function sessionActorEmployeeId(session: SessionUser): Promise<number | null> {
  try {
    return (await findEmployeeForSession(session))?.id ?? null;
  } catch {
    return null;
  }
}

/** id для user-notifications: как session.id у Bitrix (bitrix_user_id), иначе platform/id. */
export function employeeNotificationUserId(employee: ServerEmployee): number | null {
  const uid = employee.bitrix_user_id ?? employee.platform_user_id ?? employee.id;
  return uid > 0 ? uid : null;
}
