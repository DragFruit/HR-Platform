import { requireRole } from '../../utils/requireRole';
import { readEmployees, type ServerEmployee } from '../../utils/employeesStore';
import { readRaceRecords, readRaceVisits } from '../../utils/pitStopRaceStore';

/** Возможные id сессии сотрудника в race-данных. */
function raceUserIds(emp: ServerEmployee): number[] {
  const ids = new Set<number>();
  if (emp.platform_user_id != null && emp.platform_user_id > 0) ids.add(emp.platform_user_id);
  if (emp.bitrix_user_id != null && emp.bitrix_user_id > 0) ids.add(emp.bitrix_user_id);
  if (emp.id > 0) ids.add(emp.id);
  return [...ids];
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

  const rows = employees
    .filter((emp) => emp.account_role !== 'admin')
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
