import { requireVbiSession } from '../../utils/session';
import { findEmployeeById, sessionActorEmployeeId } from '../../utils/employeesStore';
import { assignAdaptationScenario } from '../../utils/adaptationScenarios';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (session.role !== 'admin' && session.role !== 'hr') {
    throw createError({ statusCode: 403, statusMessage: 'Только admin/HR' });
  }

  const body = await readBody<{
    employee_id?: number;
    scenario_id?: string;
  }>(event);

  const employeeId = Number(body?.employee_id);
  const scenarioId = String(body?.scenario_id || '').trim();

  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен employee_id' });
  }
  if (!scenarioId) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен scenario_id' });
  }

  const employee = await findEmployeeById(employeeId);
  if (!employee) {
    throw createError({ statusCode: 404, statusMessage: 'Сотрудник не найден' });
  }

  const assignment = await assignAdaptationScenario({
    employee_id: employee.id,
    employee_name: employee.name,
    scenario_id: scenarioId,
    assigned_by_user_id: session.id,
    assigned_by_name: session.name
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'adaptation:assign' });

  return { ok: true, assignment };
});
