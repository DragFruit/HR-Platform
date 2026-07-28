import { requireVbiSession } from '../../utils/session';
import { createProfileActivity } from '../../utils/profileActivityStore';
import { findEmployeeById } from '../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (session.role !== 'admin' && session.role !== 'hr') {
    throw createError({ statusCode: 403, statusMessage: 'Только admin/HR' });
  }

  const body = await readBody(event);
  const employeeId = Number(body?.employee_id);
  const employee = Number.isFinite(employeeId) ? await findEmployeeById(employeeId) : null;
  if (!employee) {
    throw createError({ statusCode: 400, statusMessage: 'Сотрудник не найден' });
  }

  const item = await createProfileActivity({
    employee_id: employee.id,
    platform_user_id: employee.platform_user_id ?? null,
    kind: String(body?.kind || 'custom'),
    text: String(body?.text || ''),
    occurred_at: body?.occurred_at ? String(body.occurred_at) : undefined,
    created_by_user_id: session.id,
    created_by_name: session.name
  });

  return { ok: true, item };
});
