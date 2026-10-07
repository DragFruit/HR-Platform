import { randomUUID } from 'node:crypto';
import { requireVbiSession } from '../../../../utils/session';
import {
  appendPageFeedbackPhotoIds,
  getAdminNotificationById
} from '../../../../utils/adminNotificationsStore';
import { assertPageFeedbackPhoto, savePageFeedbackPhoto } from '../../../../utils/pageFeedbackPhoto';

const MAX_PHOTOS = 5;

/**
 * Одно фото к уже созданной оценке.
 * Отдельно от JSON, чтобы nginx (лимит ~1 МБ по умолчанию) не ронял весь отзыв с вложениями.
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = String(getRouterParam(event, 'id') || '').trim();
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен id уведомления' });
  }

  const existing = await getAdminNotificationById(id);
  if (!existing || existing.kind !== 'page_feedback') {
    throw createError({ statusCode: 404, statusMessage: 'Оценка не найдена' });
  }
  if (existing.employee_id !== session.id) {
    throw createError({ statusCode: 403, statusMessage: 'Недостаточно прав' });
  }

  const already = [
    ...(existing.photo_ids || []),
    ...(existing.photo_id ? [existing.photo_id] : [])
  ].filter((v, i, a) => a.indexOf(v) === i);
  if (already.length >= MAX_PHOTOS) {
    throw createError({ statusCode: 400, statusMessage: `Можно не больше ${MAX_PHOTOS} фото` });
  }

  const parts = await readMultipartFormData(event);
  const filePart = parts?.find(
    (item) => (item.name === 'photo' || item.name === 'file') && item.filename
  );
  if (!filePart) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен файл фото' });
  }

  const photo = assertPageFeedbackPhoto(filePart);
  const photoId = randomUUID();
  await savePageFeedbackPhoto(photoId, photo);
  const updated = await appendPageFeedbackPhotoIds(id, session.id, [photoId]);
  return {
    ok: true,
    photo_id: photoId,
    photo_ids: updated?.photo_ids || [photoId]
  };
});
