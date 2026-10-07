import { requireVbiSession } from '../../../../utils/session';
import { readPageFeedbackPhoto } from '../../../../utils/pageFeedbackPhoto';

/** Фото к оценке страницы — admin/HR (колокольчик). */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (session.role !== 'admin' && session.role !== 'hr') {
    throw createError({ statusCode: 403, statusMessage: 'Недостаточно прав' });
  }
  const id = String(getRouterParam(event, 'id') || '').trim();
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен id' });
  }
  const photo = await readPageFeedbackPhoto(id);
  if (!photo) {
    throw createError({ statusCode: 404, statusMessage: 'Фото не найдено' });
  }
  setHeader(event, 'Content-Type', photo.mime);
  setHeader(event, 'Content-Disposition', `inline; filename="${photo.originalName.replace(/"/g, '')}"`);
  setHeader(event, 'Cache-Control', 'private, max-age=3600');
  return photo.bytes;
});
