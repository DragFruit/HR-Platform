import { requireVbiSession } from '../../../utils/session';
import { updateAdaptationScenario } from '../../../utils/adaptationScenarios';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (session.role !== 'admin' && session.role !== 'hr') {
    throw createError({ statusCode: 403, statusMessage: 'Только admin/HR' });
  }

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Не указан id' });
  }

  const body = await readBody(event);
  const scenario = await updateAdaptationScenario(id, body || {});
  return { ok: true, scenario };
});
