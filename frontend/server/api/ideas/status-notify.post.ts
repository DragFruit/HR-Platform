import { requireVbiSession } from '../../utils/session';
import {
  notifyIdeaAuthorStatusChanged,
  type IdeaNotifyStatus
} from '../../utils/ideaNotifications';

const ALLOWED_STATUSES: IdeaNotifyStatus[] = [
  'review',
  'implementation',
  'done',
  'rejected'
];

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (session.role !== 'admin' && session.role !== 'hr') {
    throw createError({ statusCode: 403, statusMessage: 'Только admin/HR' });
  }

  const body = await readBody<{
    idea_id?: string;
    idea_title?: string;
    author_user_id?: number;
    author_name?: string;
    status?: string;
    comment?: string;
    previous_status?: string;
  }>(event);

  const ideaId = String(body?.idea_id || '').trim();
  const ideaTitle = String(body?.idea_title || '').trim();
  const authorUserId = Number(body?.author_user_id);
  const authorName = String(body?.author_name || '').trim();
  const status = String(body?.status || '').trim() as IdeaNotifyStatus;
  const comment = typeof body?.comment === 'string' ? body.comment : undefined;

  if (!ideaId || !ideaTitle) {
    throw createError({ statusCode: 400, statusMessage: 'Нужны idea_id и idea_title' });
  }
  if (!Number.isFinite(authorUserId) || authorUserId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный author_user_id' });
  }
  if (!ALLOWED_STATUSES.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный status' });
  }
  const previousStatus = String(body?.previous_status || '').trim();
  if (previousStatus && previousStatus === status) {
    return { ok: true, skipped: true };
  }

  await notifyIdeaAuthorStatusChanged({
    author_user_id: authorUserId,
    author_name: authorName || 'Сотрудник',
    idea_id: ideaId,
    idea_title: ideaTitle,
    status,
    comment
  });

  return { ok: true };
});
