import { ACHIEVEMENTS_CATALOG, type AchievementDef } from '~/data/achievementsCatalog';
import type { Employee } from '~/composables/useEmployees';
import { yearsOfService } from '~/utils/tenureAnniversary';
import { PIT_STOP_ACHIEVEMENT_ID } from '~/events/pit-stop-14/rewards';

const TENURE_IDS: Array<{ id: string; years: number }> = [
  { id: 'tenure-1y', years: 1 },
  { id: 'tenure-5y', years: 5 },
  { id: 'tenure-10y', years: 10 },
  { id: 'tenure-15y', years: 15 }
];

const IDEA_DONE_TIERS = [1, 5, 10, 20, 50, 100] as const;

/**
 * Публичные ачивки для визитки (без чужого localStorage):
 * стаж по hired_at + реализованные идеи + топ-3 Pit Stop (серверные winners).
 */
export const publicAchievementsForEmployee = (
  employee: Employee,
  ideasDoneCount: number,
  opts?: { pitStopWinnerUserIds?: ReadonlySet<number> }
): AchievementDef[] => {
  const years = employee.hired_at ? yearsOfService(employee.hired_at) : 0;
  const ids = new Set<string>();

  for (const row of TENURE_IDS) {
    if (years >= row.years) ids.add(row.id);
  }

  for (const n of IDEA_DONE_TIERS) {
    if (ideasDoneCount >= n) ids.add(`idea-done-${n}`);
  }

  const uid = employee.platform_user_id ?? employee.bitrix_user_id;
  if (uid && opts?.pitStopWinnerUserIds?.has(uid)) {
    ids.add(PIT_STOP_ACHIEVEMENT_ID);
  }

  return ACHIEVEMENTS_CATALOG.filter((a) => ids.has(a.id)).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
};
