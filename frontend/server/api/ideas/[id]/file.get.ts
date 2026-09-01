import { requireVbiSession } from '../../../utils/session';
import { readIdeas } from '../../../utils/ideasStore';
import { readIdeaAttachment } from '../../../utils/ideaAttachments';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  const id = String(getRouterParam(event, 'id') || '').trim();
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен id идеи' });
  }

  const state = await readIdeas();
  const idea = state.ideas.find((item) => item.id === id);
  if (!idea) {
    throw createError({ statusCode: 404, statusMessage: 'Идея не найдена' });
  }

  const file = await readIdeaAttachment(id);
  if (!file) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Файл не сохранился на сервере. Попросите автора прикрепить снова.'
    });
  }

  const inline = file.mime.startsWith('image/') || file.mime === 'application/pdf';
  const encoded = encodeURIComponent(file.originalName);
  setHeader(event, 'Content-Type', file.mime);
  setHeader(
    event,
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`
  );
  setHeader(event, 'Cache-Control', 'private, max-age=3600');
  return file.bytes;
});
