import { requireVbiSession } from '../../../utils/session';
import { sessionNotificationRecipientIds } from '../../../utils/notificationRecipients';
import { assertIdeaAttachment, saveIdeaAttachment } from '../../../utils/ideaAttachments';
import { mutateIdeas } from '../../../utils/ideasStore';
import { toClientPayload } from '../../../utils/ideaMutations';
import { sessionActorEmployeeId } from '../../../utils/employeesStore';

/** Прикрепить / заменить файл у существующей идеи (автор или admin/HR). */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = String(getRouterParam(event, 'id') || '').trim();
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен id идеи' });
  }

  const parts = await readMultipartFormData(event);
  const filePart = parts?.find((item) => item.name === 'file' && item.filename);
  if (!filePart) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен файл' });
  }
  const attachment = assertIdeaAttachment(filePart);
  const authorIds = await sessionNotificationRecipientIds(session);

  const state = await mutateIdeas((current) => {
    const idea = current.ideas.find((item) => item.id === id);
    if (!idea) {
      throw createError({ statusCode: 404, statusMessage: 'Идея не найдена' });
    }
    const canEdit =
      session.role === 'admin' ||
      session.role === 'hr' ||
      authorIds.includes(idea.authorUserId);
    if (!canEdit) {
      throw createError({ statusCode: 403, statusMessage: 'Недостаточно прав' });
    }
    idea.attachmentName = attachment.originalName;
    idea.attachmentStored = true;
    return current;
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'idea:attach-file' });

  await saveIdeaAttachment(id, attachment);
  return toClientPayload(state, session.id);
});
