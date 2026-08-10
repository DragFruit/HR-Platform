import { createSalesBestPickDueNotification } from './adminNotificationsStore';
import {
  moscowCalendarDate,
  periodFromDate,
  periodLabelRu,
  publishRevealedSalesBestActivities
} from './salesBestAwardsStore';

export type SalesBestPickDueResult = {
  ran: boolean;
  reason?: string;
  period?: string;
  created: boolean;
  notification_id?: string;
  forced?: boolean;
  activity_published?: number;
};

/**
 * Ежедневное обслуживание ОП:
 * - 29-го (МСК) — уведомление админу выбрать лучшего;
 * - всегда — публикация ачивок/ленты для наступивших reveal_on.
 */
export async function runSalesBestPickDue(opts?: {
  force?: boolean;
  /** YYYY-MM; по умолчанию текущий месяц МСК */
  period?: string;
}): Promise<SalesBestPickDueResult> {
  const { day, date } = moscowCalendarDate();
  const forced = Boolean(opts?.force);
  const { published } = await publishRevealedSalesBestActivities();

  if (!forced && day !== 29) {
    return {
      ran: false,
      reason: `сегодня ${day}, ждём 29-е (МСК)`,
      created: false,
      activity_published: published
    };
  }

  const period = opts?.period || periodFromDate(date);
  const notification = await createSalesBestPickDueNotification({
    period,
    period_label: periodLabelRu(period)
  });

  return {
    ran: true,
    period,
    created: true,
    notification_id: notification.id,
    forced,
    activity_published: published
  };
}
