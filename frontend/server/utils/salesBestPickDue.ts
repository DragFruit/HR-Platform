import { createSalesBestPickDueNotification } from './adminNotificationsStore';
import { moscowCalendarDate, periodFromDate, periodLabelRu } from './salesBestAwardsStore';

export type SalesBestPickDueResult = {
  ran: boolean;
  reason?: string;
  period?: string;
  created: boolean;
  notification_id?: string;
  forced?: boolean;
};

/**
 * 29-го числа (МСК) создаёт админ-уведомление «выберите лучшего ОП».
 * force=true — для теста «как будто сегодня 29-е».
 */
export async function runSalesBestPickDue(opts?: {
  force?: boolean;
  /** YYYY-MM; по умолчанию текущий месяц МСК */
  period?: string;
}): Promise<SalesBestPickDueResult> {
  const { day, date } = moscowCalendarDate();
  const forced = Boolean(opts?.force);
  if (!forced && day !== 29) {
    return { ran: false, reason: `сегодня ${day}, ждём 29-е (МСК)`, created: false };
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
    forced
  };
}
