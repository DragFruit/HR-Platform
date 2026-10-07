import { requireVbiSession } from '../../utils/session';
import { createPageFeedbackNotification } from '../../utils/adminNotificationsStore';
import { findEmployeeByName } from '../../utils/employeesStore';
import { isBitrixImbotConfigured, sendBitrixImbotMessage } from '../../utils/bitrixImbot';

const SYSTEM_ADMIN_NAME = 'Драго Станислава';

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

/**
 * Оценка страницы: только JSON (stars/comment/page).
 * Фото — отдельными POST /api/knowledge/feedback/:id/photo (иначе nginx 1 МБ режет весь отзыв).
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{
    stars?: number;
    comment?: string;
    page?: string;
    page_label?: string;
    /** сколько фото клиент дошлёт следом — только для текста в Bitrix */
    photo_count?: number;
  }>(event);

  const stars = Number(body?.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw createError({ statusCode: 400, statusMessage: 'Нужна оценка от 1 до 5' });
  }

  const comment = String(body?.comment || '').trim().slice(0, 2000);
  const page = String(body?.page || '/knowledge').trim() || '/knowledge';
  const label = labelForPage(page, String(body?.page_label || '').trim() || undefined);
  const photoCount = Math.min(5, Math.max(0, Number(body?.photo_count) || 0));

  const notification = await createPageFeedbackNotification({
    employee_id: session.id,
    employee_name: session.name,
    stars,
    comment,
    page
  });

  if ((comment || photoCount > 0) && isBitrixImbotConfigured()) {
    const who = session.name;
    void (async () => {
      try {
        const admin = await findEmployeeByName(SYSTEM_ADMIN_NAME);
        const bitrixUserId = admin?.bitrix_user_id ?? admin?.platform_user_id ?? 0;
        if (bitrixUserId <= 0) {
          console.warn(`[knowledge-feedback] нет bitrix id у «${SYSTEM_ADMIN_NAME}»`);
          return;
        }
        const photoLine =
          photoCount === 1
            ? 'Фото: 1 шт. (смотри в колокольчике Vibe)'
            : photoCount > 1
              ? `Фото: ${photoCount} шт. (смотри в колокольчике Vibe)`
              : null;
        const lines = [
          `Оценка раздела «${label}»: ${stars}/5`,
          `Кто: ${who}`,
          comment ? `Комментарий: ${comment}` : null,
          photoLine
        ].filter(Boolean) as string[];
        await sendBitrixImbotMessage({ bitrixUserId, message: lines.join('\n') });
      } catch (err) {
        console.warn('[knowledge-feedback] imbot failed:', err);
      }
    })();
  }

  return {
    ok: true,
    notification_id: notification.id
  };
});
