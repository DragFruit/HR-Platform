import { randomUUID } from 'node:crypto';
import { requireVbiSession } from '../../utils/session';
import { createPageFeedbackNotification } from '../../utils/adminNotificationsStore';
import { findEmployeeByName } from '../../utils/employeesStore';
import { isBitrixImbotConfigured, sendBitrixImbotMessage } from '../../utils/bitrixImbot';
import { assertPageFeedbackPhoto, savePageFeedbackPhoto } from '../../utils/pageFeedbackPhoto';

const SYSTEM_ADMIN_NAME = 'Драго Станислава';
const MAX_PHOTOS = 5;

const PAGE_LABELS: Record<string, string> = {
  '/knowledge': 'База знаний',
  '/vacations': 'Отпуска',
  '/ideas': 'Банк идей',
  '/vpn': 'VPN',
  '/profile': 'Профиль'
};

function labelForPage(page: string, fallback?: string) {
  if (fallback) return fallback;
  return PAGE_LABELS[page] || page;
}

type FeedbackFields = {
  stars: number;
  comment: string;
  page: string;
  page_label: string;
  photos: ReturnType<typeof assertPageFeedbackPhoto>[];
};

async function parseFeedback(event: Parameters<typeof readBody>[0]): Promise<FeedbackFields> {
  const contentType = String(getHeader(event, 'content-type') || '');
  if (contentType.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event);
    const field = (name: string) => {
      const part = parts?.find((item) => item.name === name && !item.filename);
      return part?.data?.toString('utf8') ?? '';
    };
    const fileParts =
      parts?.filter(
        (item) => (item.name === 'photo' || item.name === 'file') && item.filename
      ) ?? [];
    return {
      stars: Number(field('stars')),
      comment: String(field('comment') || '').trim().slice(0, 2000),
      page: String(field('page') || '/knowledge').trim() || '/knowledge',
      page_label: String(field('page_label') || '').trim(),
      photos: fileParts.slice(0, MAX_PHOTOS).map((part) => assertPageFeedbackPhoto(part))
    };
  }

  const body = await readBody<{
    stars?: number;
    comment?: string;
    page?: string;
    page_label?: string;
  }>(event);
  return {
    stars: Number(body?.stars),
    comment: String(body?.comment || '').trim().slice(0, 2000),
    page: String(body?.page || '/knowledge').trim() || '/knowledge',
    page_label: String(body?.page_label || '').trim(),
    photos: []
  };
}

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const fields = await parseFeedback(event);

  if (!Number.isInteger(fields.stars) || fields.stars < 1 || fields.stars > 5) {
    throw createError({ statusCode: 400, statusMessage: 'Нужна оценка от 1 до 5' });
  }

  const label = labelForPage(fields.page, fields.page_label || undefined);
  const photoIds: string[] = [];
  for (const photo of fields.photos) {
    const id = randomUUID();
    await savePageFeedbackPhoto(id, photo);
    photoIds.push(id);
  }

  const notification = await createPageFeedbackNotification({
    employee_id: session.id,
    employee_name: session.name,
    stars: fields.stars,
    comment: fields.comment,
    page: fields.page,
    photo_id: photoIds[0],
    photo_ids: photoIds.length ? photoIds : undefined
  });

  if ((fields.comment || photoIds.length) && isBitrixImbotConfigured()) {
    const admin = await findEmployeeByName(SYSTEM_ADMIN_NAME);
    const bitrixUserId = admin?.bitrix_user_id ?? admin?.platform_user_id ?? 0;
    if (bitrixUserId > 0) {
      const photoLine =
        photoIds.length === 1
          ? 'Фото: 1 шт. (смотри в колокольчике Vibe)'
          : photoIds.length > 1
            ? `Фото: ${photoIds.length} шт. (смотри в колокольчике Vibe)`
            : null;
      const lines = [
        `Оценка раздела «${label}»: ${fields.stars}/5`,
        `Кто: ${session.name}`,
        fields.comment ? `Комментарий: ${fields.comment}` : null,
        photoLine
      ].filter(Boolean) as string[];
      try {
        await sendBitrixImbotMessage({
          bitrixUserId,
          message: lines.join('\n')
        });
      } catch (err) {
        console.warn('[knowledge-feedback] imbot failed:', err);
      }
    } else {
      console.warn(`[knowledge-feedback] нет bitrix id у «${SYSTEM_ADMIN_NAME}»`);
    }
  }

  return {
    ok: true,
    notification_id: notification.id,
    photo_ids: photoIds
  };
});
