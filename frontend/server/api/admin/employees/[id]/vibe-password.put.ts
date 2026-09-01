import { requireRole } from '../../../../utils/requireRole';
import { readEmployees } from '../../../../utils/employeesStore';
import { clearVibePassword, setVibePassword } from '../../../../utils/vibePasswordsStore';

/** Админ/HR задаёт или сбрасывает локальный пароль Vibe у сотрудника. */
export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);

  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' });
  }

  const body = await readBody<{ password?: string | null; clear?: boolean }>(event);
  const list = await readEmployees();
  const emp = list.find((e) => e.id === id);
  if (!emp) {
    throw createError({ statusCode: 404, statusMessage: 'Сотрудник не найден' });
  }

  if (body?.clear === true || body?.password === null) {
    await clearVibePassword(id);
    return { ok: true, employee_id: id, has_password: false };
  }

  const password = String(body?.password || '');
  await setVibePassword(id, password);
  return { ok: true, employee_id: id, has_password: true };
});
