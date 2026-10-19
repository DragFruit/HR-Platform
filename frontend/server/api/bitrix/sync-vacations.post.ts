import { runBitrixVacationMaintenance } from '../../utils/bitrixVacationAbsence';
import type { ReconcileAbsencesResult } from '../../utils/bitrixVacationAbsence';
import { requireRole } from '../../utils/requireRole';
import { isBitrixWritesBlockedMessage } from '../../utils/bitrixWriteGuard';
import { mutateVacations } from '../../utils/vacationsStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);

  let synced = 0;
  let failed = 0;
  /** Стейдж/локалка: запись в Bitrix выключена — не ошибка, а skipped. */
  let blocked = 0;
  let reconcile: Omit<ReconcileAbsencesResult, 'state'> | null = null;

  const state = await mutateVacations(async (current) => {
    const before = new Map(
      Object.values(current.requestsByYear)
        .flat()
        .map((r) => [r.id, r.bitrix_sync_status] as const)
    );
    // Повтор failed/skipped + перенос, затем сверка дат будущих отпусков с графиком отсутствий.
    const result = await runBitrixVacationMaintenance(current);
    reconcile = result.reconcile;
    for (const r of Object.values(result.state.requestsByYear).flat()) {
      const prev = before.get(r.id);
      if (prev !== 'failed' && prev !== 'skipped') continue;
      if (r.bitrix_sync_status === 'synced') synced += 1;
      else if (isBitrixWritesBlockedMessage(r.bitrix_sync_error)) blocked += 1;
      else if (r.bitrix_sync_status === 'failed' || r.bitrix_sync_status === 'skipped') failed += 1;
    }
    return result.state;
  });

  return {
    ok: true,
    synced,
    failed,
    blocked,
    reconcile,
    primaryYear: state.primaryYear
  };
});
