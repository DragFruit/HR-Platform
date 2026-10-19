import { requireRole } from '../../../utils/requireRole';
import { readEmployees, sessionActorEmployeeId, writeEmployees } from '../../../utils/employeesStore';
import { readVacations, writeVacations } from '../../../utils/vacationsStore';
import { applyVacationYearRollover } from '../../../utils/vacationYearRollover';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin', 'hr']);

  const body = await readBody<{ fromYear?: number; toYear?: number }>(event);
  const fromYear = Number(body?.fromYear);
  const toYear = Number(body?.toYear);

  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Укажите fromYear и toYear (целые числа, toYear = fromYear + 1)'
    });
  }

  const [employees, vacations] = await Promise.all([readEmployees(), readVacations()]);

  if (vacations.primaryYear !== fromYear) {
    throw createError({
      statusCode: 409,
      statusMessage: `Текущий учётный год ${vacations.primaryYear}, ожидался fromYear=${fromYear}`
    });
  }

  const result = applyVacationYearRollover(employees, vacations, fromYear, toYear);
  const ctx = { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'vacation-rollover' };
  await Promise.all([writeEmployees(result.employees, ctx), writeVacations(result.vacations, ctx)]);

  return {
    ok: true,
    fromYear,
    toYear,
    updated: result.updates.length,
    skipped: result.skipped,
    updates: result.updates
  };
});
