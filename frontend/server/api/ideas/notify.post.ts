import { requireVbiSession } from '../../utils/session';
import { createIdeaSubmittedNotification } from '../../utils/adminNotificationsStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);

  const body = await readBody<{
    idea_id?: string;
    idea_title?: string;
    employee_id?: number;
    employee_name?: string;
  }>(event);

  const ideaId = String(body?.idea_id || '').trim();
  const ideaTitle = String(body?.idea_title || '').trim();
  // Не даём подставить чужой employee_id — только текущий пользователь.
  const employeeId = session.id;
  const employeeName = session.name;

  if (!ideaId || !ideaTitle) {
    throw createError({ statusCode: 400, statusMessage: 'Нужны idea_id и idea_title' });
  }

  const notification = await createIdeaSubmittedNotification({
    employee_id: employeeId,
    employee_name: employeeName,
    idea_id: ideaId,
    idea_title: ideaTitle
  });

  return { ok: true, notification };
});
