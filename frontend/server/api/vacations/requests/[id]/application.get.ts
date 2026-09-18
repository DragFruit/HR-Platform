import { send } from 'h3';
import { employeeNamesMatch } from '../../../../../app/utils/employeeName';
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
  isLaborContractEmployee,
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
  const elevated = session.role === 'admin' || session.role === 'hr';
  const owns =
    (me?.id && request.employee_id && me.id === request.employee_id) ||
    (me && employeeNamesMatch(me.name, request.employee));
  if (!elevated && !owns) {
    throw createError({ statusCode: 403, statusMessage: 'Нет доступа к этой заявке' });
  }
  if (request.status !== 'approved') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Заявление доступно только после согласования заявки'
    });
  }
  if (request.start <= todayIso()) {
    throw createError({ statusCode: 403, statusMessage: 'Заявление доступно до начала отпуска' });
  }

  const employee =
    (request.employee_id ? await findEmployeeById(request.employee_id) : null) ??
    (await findEmployeeByName(request.employee));
  if (!employee) {
    throw createError({ statusCode: 404, statusMessage: 'Сотрудник заявки не найден в справочнике' });
  }
  if (!isLaborContractEmployee(employee.contract_form)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Заявление доступно только сотрудникам с трудовым договором (ТД)'
    });
  }

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
