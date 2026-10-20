import { send } from 'h3';
import {
  canViewVacationApplication,
  vacationApplicationDenyReason
} from '../../../../../app/utils/vacationApplicationAccess';
import { todayIso } from '../../../../../app/utils/vacationCalendar';
import { requireVbiSession } from '../../../../utils/session';
import {
  findEmployeeById,
  findEmployeeByName,
  findEmployeeForSession
} from '../../../../utils/employeesStore';
import { readVacations } from '../../../../utils/vacationsStore';
import {
  buildVacationApplicationDocx,
  vacationApplicationFilename
} from '../../../../utils/vacationApplicationDocx';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id заявки' });
  }

  const request = Object.values((await readVacations()).requestsByYear)
    .flat()
    .find((item) => item.id === id);
  if (!request) throw createError({ statusCode: 404, statusMessage: 'Заявка не найдена' });

  const me = await findEmployeeForSession(session);
  if (!canViewVacationApplication({ role: session.role, employeeId: me?.id, employeeName: me?.name }, request)) {
    throw createError({ statusCode: 403, statusMessage: 'Нет доступа к этой заявке' });
  }

  const employee =
    (request.employee_id ? await findEmployeeById(request.employee_id) : null) ??
    (await findEmployeeByName(request.employee));
  if (!employee) {
    throw createError({ statusCode: 404, statusMessage: 'Сотрудник заявки не найден в справочнике' });
  }
  // С 2026-10-20: pending (любой шаг) и approved; rejected — нет. Документ одинаковый для обоих статусов.
  const denied = vacationApplicationDenyReason({
    status: request.status,
    start: request.start,
    today: todayIso(),
    contractForm: employee.contract_form
  });
  if (denied) throw createError({ statusCode: 403, statusMessage: denied });

  let bytes: Buffer;
  try {
    bytes = await buildVacationApplicationDocx({
      employeeName: employee.name,
      position: employee.title,
      legalEntity: employee.legal_entity ?? '',
      startDate: request.start,
      endDate: request.end
    });
  } catch (err) {
    console.error('[vacation-application]', err);
    throw createError({
      statusCode: 500,
      statusMessage: 'Не удалось сформировать заявление. Попробуйте позже или напишите в HR.'
    });
  }

  const encoded = encodeURIComponent(vacationApplicationFilename(employee.name, request.start));
  setHeader(
    event,
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  setHeader(event, 'Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
  setHeader(event, 'Cache-Control', 'private, no-store');
  return send(event, bytes);
});
