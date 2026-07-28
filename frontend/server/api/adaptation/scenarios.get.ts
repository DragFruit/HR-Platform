import { requireVbiSession } from '../../utils/session';
import {
  listAdaptationAssignments,
  listAdaptationScenarios,
  ADAPTATION_OWNER_OPTIONS,
  ADAPTATION_PHASE_OPTIONS
} from '../../utils/adaptationScenarios';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (session.role !== 'admin' && session.role !== 'hr') {
    throw createError({ statusCode: 403, statusMessage: 'Только admin/HR' });
  }

  const scenarios = await listAdaptationScenarios();
  const assignments = await listAdaptationAssignments();
  return {
    scenarios,
    assignments,
    phase_options: ADAPTATION_PHASE_OPTIONS,
    owner_options: ADAPTATION_OWNER_OPTIONS
  };
});
