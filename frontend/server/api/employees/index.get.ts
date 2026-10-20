import { requireVbiSession } from '../../utils/session';
import { readEmployees } from '../../utils/employeesStore';
import { birthdayWithoutYear } from '../../utils/bitrixBirthday';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const list = await readEmployees();
  // Год рождения (возраст) видят только admin/hr: они редактируют справочник целиком (PUT).
  if (session.role === 'admin' || session.role === 'hr') return list;
  return list.map((row) =>
    row.birthday ? { ...row, birthday: birthdayWithoutYear(row.birthday) } : row
  );
});
