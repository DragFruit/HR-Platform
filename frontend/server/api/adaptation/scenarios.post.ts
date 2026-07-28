import { requireVbiSession } from '../../utils/session';
import { createAdaptationScenario } from '../../utils/adaptationScenarios';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (session.role !== 'admin' && session.role !== 'hr') {
    throw createError({ statusCode: 403, statusMessage: 'Только admin/HR' });
  }

  const body = await readBody(event);
  const scenario = await createAdaptationScenario(body || {});
  return { ok: true, scenario };
});
