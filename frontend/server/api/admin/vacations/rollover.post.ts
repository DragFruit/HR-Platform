import { requireRole } from '../../../utils/requireRole';
import { sessionActorEmployeeId } from '../../../utils/employeesStore';
import { readVacations } from '../../../utils/vacationsStore';
import { runVacationYearRollover } from '../../../utils/vacationYearRollover';
import { vacationRolloverDeps } from '../../../utils/vacationYearRolloverRun';

/**
 * Ручной переход учётного года (обычно не нужен: плагин vacation-year-rollover делает его 1 января).
 * Та же атомарная функция, что и автоматика: заявки, созданные в этот момент, не теряются.
 */
export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin', 'hr']);

  const body = await readBody<{ fromYear?: number; toYear?: number }>(event);
  const fromYear = Number(body?.fromYear);
  const toYear = Number(body?.toYear);

  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || toYear !== fromYear + 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Укажите fromYear и toYear (целые числа, toYear = fromYear + 1)'
    });
  }

  const { primaryYear } = await readVacations();
  if (primaryYear !== fromYear && primaryYear !== toYear) {
    throw createError({
      statusCode: 409,
      statusMessage: `Текущий учётный год ${primaryYear}, ожидался fromYear=${fromYear}`
    });
  }

  const ctx = {
    actorEmployeeId: await sessionActorEmployeeId(session),
    reason: 'vacation-rollover:admin'
  };
  const result = await runVacationYearRollover(vacationRolloverDeps(), toYear, ctx);
  if (result.changed) {
    console.info(
      `[vacation-rollover] admin: учётный год ${result.fromYear} → ${result.toYear}, остатков перенесено ${result.updated}`
    );
  }

  return {
    ok: true,
    alreadyDone: !result.changed,
    fromYear,
    toYear,
    updated: result.updated,
    skipped: result.skipped,
    updates: result.updates
  };
});
