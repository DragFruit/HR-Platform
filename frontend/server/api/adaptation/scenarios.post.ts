import { requireVbiSession } from '../../utils/session';
import { createAdaptationScenario } from '../../utils/adaptationScenarios';
import { sessionActorEmployeeId } from '../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (session.role !== 'admin' && session.role !== 'hr') {
    throw createError({ statusCode: 403, statusMessage: 'Только admin/HR' });
  }

  const body = await readBody(event);
  const scenario = await createAdaptationScenario(body || {}, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'adaptation:scenario-create' });
  return { ok: true, scenario };
});
