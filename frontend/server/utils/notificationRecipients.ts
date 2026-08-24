import type { SessionUser } from './credentials';
import { findEmployeeForSession } from './employeesStore';

/** Все id, под которыми у сессии могут лежать user-notifications. */
export async function sessionNotificationRecipientIds(session: SessionUser): Promise<number[]> {
  const ids = new Set<number>();
  const add = (value?: number | null) => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) ids.add(value);
  };
  add(session.id);
  add(session.bitrix_user_id);
  const employee = await findEmployeeForSession(session);
  if (employee) {
    add(employee.id);
    add(employee.platform_user_id);
    add(employee.bitrix_user_id);
  }
  return [...ids];
}
