import { requireVbiSession } from '../../utils/session';
import { findEmployeeForSession } from '../../utils/employeesStore';
import {
  countRevealedSalesBestForEmployee,
  listRevealedSalesBestForEmployee,
  moscowCalendarDate
} from '../../utils/salesBestAwardsStore';

function todayMskIso(): string {
  const { year, month, day } = moscowCalendarDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default defineEventHandler(async (event) => {
  const user = await requireVbiSession(event);
  const employee = await findEmployeeForSession(user);
  if (!employee) {
    return { count: 0, awards: [], today: todayMskIso() };
  }

  const today = todayMskIso();
  const awards = await listRevealedSalesBestForEmployee(employee.id, today);
  const count = await countRevealedSalesBestForEmployee(employee.id, today);
  return { count, awards, today };
});
