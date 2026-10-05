import { requireRole } from '../../utils/requireRole';
import { readEmployees, type ServerEmployee } from '../../utils/employeesStore';
import { readRaceRecords, readRaceVisits } from '../../utils/pitStopRaceStore';
import { getDeployAppEnv } from '../../utils/appEnv';
import {
  isQaTestEmployeeId,
  QA_TEST_DEPARTMENT_NAME
} from '../../../app/data/qaTestDepartment';

/** Возможные id сессии сотрудника в race-данных. */
function raceUserIds(emp: ServerEmployee): number[] {
  const ids = new Set<number>();
  if (emp.platform_user_id != null && emp.platform_user_id > 0) ids.add(emp.platform_user_id);
  if (emp.bitrix_user_id != null && emp.bitrix_user_id > 0) ids.add(emp.bitrix_user_id);
  if (emp.id > 0) ids.add(emp.id);
  return [...ids];
}

/** На бое не показываем QA/демо со стейджа, даже если остались в файле. */
function isStagingTestEmployee(emp: ServerEmployee): boolean {
  if (isQaTestEmployeeId(emp.id)) return true;
  if (emp.department === QA_TEST_DEPARTMENT_NAME) return true;
  const email = emp.email?.trim().toLowerCase() ?? '';
  if (email.endsWith('@vbi.local')) return true;
  return false;
}

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin']);
  const [employees, records, visits] = await Promise.all([
    readEmployees(),
    readRaceRecords(),
    readRaceVisits()
  ]);

  const recordByUser = new Map(records.map((r) => [r.userId, r]));
  const visitByUser = new Map(visits.map((v) => [v.userId, v]));
  const hideStagingTests = getDeployAppEnv() === 'production';

  // Весь справочник (в т.ч. account_role=admin вроде Драго). QA/демо стейджа на бое — нет.
  const rows = employees
    .filter((emp) => !(hideStagingTests && isStagingTestEmployee(emp)))
    .map((emp) => {
      const ids = raceUserIds(emp);
      const record = ids.map((id) => recordByUser.get(id)).find(Boolean);
      const visit = ids.map((id) => visitByUser.get(id)).find(Boolean);
      const laps = record?.laps ?? 0;
      const entered = Boolean(visit || record);
      return {
        employeeId: emp.id,
        name: emp.name,
        department: emp.department || '',
        entered,
        laps
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const enteredCount = rows.filter((r) => r.entered).length;
  const racedCount = rows.filter((r) => r.laps > 0).length;

  return {
    players: rows,
    summary: {
      total: rows.length,
      entered: enteredCount,
      raced: racedCount
    }
  };
});
