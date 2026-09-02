import { send } from 'h3';
import { employeeNamesMatch } from '../../../../../app/utils/employeeName';
import type { SessionUser } from '../../../../utils/credentials';
import { requireVbiSession } from '../../../../utils/session';
import { findEmployeeByName, findEmployeeForSession } from '../../../../utils/employeesStore';
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
  if (
    !elevated &&
    (!sessionEmployee || !sameEmployeeName(sessionEmployee.name, request.employee))
  ) {
    throw createError({ statusCode: 403, statusMessage: 'Нет доступа к этой заявке' });
  }

  if (request.status !== 'approved') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Заявление доступно только после согласования заявки'
    });
  }

  const employee = await findEmployeeByName(request.employee);
  if (!employee || !isLaborContractEmployee(employee.contract_form)) {
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
    const message = err instanceof Error ? err.message : 'Не удалось сформировать заявление';
    throw createError({ statusCode: 500, message });
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
