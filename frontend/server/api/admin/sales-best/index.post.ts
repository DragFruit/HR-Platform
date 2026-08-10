import { requireRole } from '../../../utils/requireRole';
import { findEmployeeById } from '../../../utils/employeesStore';
import { upsertSalesBestAward, periodLabelRu } from '../../../utils/salesBestAwardsStore';
import { normalizeDepartment } from '../../../../app/data/departments';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin', 'hr']);
  const body = await readBody<{ period?: string; employee_id?: number }>(event);
  const period = String(body?.period || '').trim();
  const employeeId = Number(body?.employee_id);

  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите period (YYYY-MM)' });
  }
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите employee_id' });
  }

  const employee = await findEmployeeById(employeeId);
  if (!employee) {
    throw createError({ statusCode: 404, statusMessage: 'Сотрудник не найден' });
  }

  const dept = normalizeDepartment(String(employee.department || ''));
  if (dept !== 'Отдел продаж' && !/продаж/i.test(String(employee.department || ''))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Лучший специалист продаж — только сотрудники отдела продаж'
    });
  }

  const award = await upsertSalesBestAward({
    period,
    employee_id: employee.id,
    employee_name: employee.name,
    selected_by: session.id
  });

  return {
    ok: true,
    award,
    period_label: periodLabelRu(period),
    message: `Выбор зафиксирован. Ачивка появится у сотрудника с ${award.reveal_on} (первый рабочий день следующего месяца). До этой даты интрига сохраняется.`
  };
});
