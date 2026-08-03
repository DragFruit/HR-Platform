import { retryFailedBitrixVacationSyncs } from '../../utils/bitrixVacationAbsence';
import { requireRole } from '../../utils/requireRole';
import { mutateVacations } from '../../utils/vacationsStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);

  let synced = 0;
  let failed = 0;

  const state = await mutateVacations(async (current) => {
    const before = new Map(
      Object.values(current.requestsByYear)
        .flat()
        .map((r) => [r.id, r.bitrix_sync_status] as const)
    );
    const next = await retryFailedBitrixVacationSyncs(current);
    for (const r of Object.values(next.requestsByYear).flat()) {
      const prev = before.get(r.id);
      if (prev !== 'failed' && prev !== 'skipped') continue;
      if (r.bitrix_sync_status === 'synced') synced += 1;
      else if (r.bitrix_sync_status === 'failed' || r.bitrix_sync_status === 'skipped') failed += 1;
    }
    return next;
  });

  return {
    ok: true,
    synced,
    failed,
    primaryYear: state.primaryYear
  };
});
