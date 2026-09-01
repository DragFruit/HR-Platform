import { requireRole } from '../../../utils/requireRole';
import { listVibePasswordEmployeeIds } from '../../../utils/vibePasswordsStore';

/** Какие сотрудники уже имеют локальный пароль Vibe (без самих хешей). */
export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const ids = await listVibePasswordEmployeeIds();
  return { employee_ids: ids };
});
