import { send } from 'h3';
import { employeeNamesMatch } from '../../../../../app/utils/employeeName';
import { todayIso } from '../../../../../app/utils/vacationCalendar';
import type { SessionUser } from '../../../../utils/credentials';
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

const sameEmployeeName = (a?: string | null, b?: string | null): boolean =>
  Boolean(a && b) && employeeNamesMatch(a!, b!);

const hasRosterWideRights = (session: SessionUser): boolean =>
  session.role === 'admin' || session.role === 'hr';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id заявки' });
  }

  const vacations = await readVacations();
  const request = Object.values(vacations.requestsByYear)
    .flat()
    .find((item) => item.id === id);

  if (!request) {
    throw createError({ statusCode: 404, statusMessage: 'Заявка не найдена' });
  }

  const sessionEmployee = await findEmployeeForSession(session);
  const elevated = hasRosterWideRights(session);
  const ownsById =
    Boolean(sessionEmployee?.id) &&
    Boolean(request.employee_id) &&
    sessionEmployee!.id === request.employee_id;
  const ownsByName =
    Boolean(sessionEmployee) && sameEmployeeName(sessionEmployee!.name, request.employee);
  if (!elevated && !ownsById && !ownsByName) {
    throw createError({ statusCode: 403, statusMessage: 'Нет доступа к этой заявке' });
  }

  if (request.status !== 'approved') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Заявление доступно только после согласования заявки'
    });
  }

  if (request.start <= todayIso()) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Заявление доступно до начала отпуска'
    });
  }

  const employee =
    (request.employee_id ? await findEmployeeById(request.employee_id) : null) ??
    (await findEmployeeByName(request.employee));

  if (!employee) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Сотрудник заявки не найден в справочнике'
    });
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
