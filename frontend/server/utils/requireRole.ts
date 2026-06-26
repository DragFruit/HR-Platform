import type { H3Event } from 'h3';
import type { AuthRole } from './credentials';
import { requireVbiSession } from './session';

export async function requireRole(event: H3Event, roles: AuthRole[]) {
  const session = await requireVbiSession(event);
  if (!roles.includes(session.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Недостаточно прав' });
  }
  return session;
}
