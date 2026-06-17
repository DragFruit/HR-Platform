import { requireVbiSession } from '../../../utils/session';
import { findEmployeeByPlatformUserId } from '../../../utils/employeesStore';
import { addStepCompletion } from '../../../utils/adaptationStore';
import { loadTrackFull } from '../../../utils/trackLoader';

export default defineEventHandler(async (event) => {
  const session = requireVbiSession(event);
  const stepId = getRouterParam(event, 'stepId');
  if (!stepId) {
    throw createError({ statusCode: 400, statusMessage: 'Не указан stepId' });
  }

  const employee = await findEmployeeByPlatformUserId(session.id);
  if (!employee) {
    throw createError({ statusCode: 400, statusMessage: 'Сотрудник не найден в справочнике' });
  }

  const track = await loadTrackFull();
  let stepOwner: string | null = null;
  for (const phase of track.phases) {
    const step = phase.steps.find((s) => s.id === stepId);
    if (step) {
      stepOwner = step.owner;
      break;
    }
  }
  if (!stepOwner) {
    throw createError({ statusCode: 404, statusMessage: 'Шаг не найден' });
  }

  const canComplete =
    stepOwner === 'employee' ||
    (stepOwner === 'manager' && (session.role === 'manager' || session.role === 'admin')) ||
    (stepOwner === 'hr' && (session.role === 'admin' || session.role === 'hr')) ||
    stepOwner === 'buddy';

  if (!canComplete && session.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Нет прав отметить этот шаг' });
  }

  const completion = await addStepCompletion({
    step_id: stepId,
    employee_id: employee.id,
    completed_at: new Date().toISOString(),
    completed_by_user_id: session.id
  });

  return { ok: true, completion };
});
