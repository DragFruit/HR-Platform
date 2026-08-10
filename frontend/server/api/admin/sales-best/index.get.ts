import { requireRole } from '../../../utils/requireRole';
import {
  listSalesBestAwards,
  getSalesBestAwardForPeriod,
  periodLabelRu,
  moscowCalendarDate,
  periodFromDate,
  revealOnForPeriod
} from '../../../utils/salesBestAwardsStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const query = getQuery(event);
  const period =
    String(query.period || '').trim() || periodFromDate(moscowCalendarDate().date);

  const awards = await listSalesBestAwards();
  const current = await getSalesBestAwardForPeriod(period);

  return {
    period,
    period_label: periodLabelRu(period),
    reveal_on: revealOnForPeriod(period),
    current,
    awards
  };
});
