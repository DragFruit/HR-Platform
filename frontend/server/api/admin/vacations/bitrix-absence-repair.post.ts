import { requireRole } from '../../../utils/requireRole';
import { mutateVacations } from '../../../utils/vacationsStore';
import { repairMisplacedCalendarAbsences } from '../../../utils/bitrixVacationAbsence';

/**
 * Чинит ошибочный sync отсутствий:
 * удаляет calendar.event у владельца вебхука и заново пишет lists.element.add нужному сотруднику.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);

  const body = await readBody<{ resync?: boolean; ownerUserId?: number }>(event).catch(() => ({}));
  const resync = body?.resync !== false;
  const ownerUserId =
    typeof body?.ownerUserId === 'number' && body.ownerUserId > 0 ? body.ownerUserId : undefined;

  let repairResult = null as Awaited<ReturnType<typeof repairMisplacedCalendarAbsences>>['result'] | null;

  await mutateVacations(async (state) => {
    const repaired = await repairMisplacedCalendarAbsences(state, { resync, ownerUserId });
    repairResult = repaired.result;
    return repaired.state;
  });

  return {
    ok: true,
    ...repairResult
  };
});
