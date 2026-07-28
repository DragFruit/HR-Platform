import { getVbiSession } from '../../utils/session';
import { createIdeaSubmittedNotification } from '../../utils/adminNotificationsStore';

export default defineEventHandler(async (event) => {
  const session = getVbiSession(event);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Нужна авторизация' });
  }

  const body = await readBody<{
    idea_id?: string;
    idea_title?: string;
    employee_id?: number;
    employee_name?: string;
  }>(event);

  const ideaId = String(body?.idea_id || '').trim();
  const ideaTitle = String(body?.idea_title || '').trim();
  const employeeId = Number(body?.employee_id || session.id);
  const employeeName = String(body?.employee_name || session.name || '').trim();

  if (!ideaId || !ideaTitle) {
    throw createError({ statusCode: 400, statusMessage: 'Нужны idea_id и idea_title' });
  }
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный employee_id' });
  }

  const notification = await createIdeaSubmittedNotification({
    employee_id: employeeId,
    employee_name: employeeName || session.name,
    idea_id: ideaId,
    idea_title: ideaTitle
  });

  return { ok: true, notification };
});
