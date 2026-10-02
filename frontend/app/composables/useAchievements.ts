import {
  ACHIEVEMENTS_CATALOG,
  PROFILE_ACHIEVEMENT_SLOTS,
  groupAchievementsBySection,
  tierAchievementIds,
  type AchievementCatalogSection,
  type AchievementDef
} from '~/data/achievementsCatalog';
import { countVacationBillableDays } from '~/utils/vacationCalendar';
import {
  TENURE_GIFT_YEARS,
  tenureAnniversaryNotifyKey,
  yearsOfService
} from '~/utils/tenureAnniversary';

const CELEBRATION_KEY = 'vbi-tenure-celebration-v1';
const STORE_PURCHASES_KEY = 'vbi-store-purchases-v1';
const ORDERS_KEY = 'vbi-tenure-gift-orders-v1';
const FULL_VACATION_DAYS = 28;

type StorePurchase = {
  id: string;
  userId: number;
  itemId: number | string;
  itemName: string;
  createdAt: string;
};

const readCelebrationClaimed = (): string[] => {
  if (!import.meta.client) return [];
  try {
    const raw = localStorage.getItem(CELEBRATION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { claimed?: string[] };
    return Array.isArray(parsed.claimed) ? parsed.claimed : [];
  } catch {
    return [];
  }
};

const readVacationTrainingCompleted = (userId: number): boolean => {
  if (!import.meta.client) return false;
  try {
    const raw = localStorage.getItem('vbi-vacation-training-v1');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { completed?: number[] };
    return Array.isArray(parsed.completed) && parsed.completed.includes(userId);
  } catch {
    return false;
  }
};

const readStorePurchases = (userId: number): StorePurchase[] => {
  if (!import.meta.client) return [];
  try {
    const raw = localStorage.getItem(STORE_PURCHASES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { purchases?: StorePurchase[] };
    const list = Array.isArray(parsed.purchases) ? parsed.purchases : [];
    return list.filter((row) => row.userId === userId);
  } catch {
    return [];
  }
};

const readTenureOrdersCount = (userId: number, employeeId: number): number => {
  if (!import.meta.client) return 0;
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as {
      orders?: Array<{ userId: number; employeeId: number }>;
    };
    const list = Array.isArray(parsed.orders) ? parsed.orders : [];
    return list.filter((o) => o.userId === userId || o.employeeId === employeeId).length;
  } catch {
    return 0;
  }
};

const tenureAchievementId = (years: number) => {
  if (years === 1) return 'tenure-1y';
  if (years === 5) return 'tenure-5y';
  if (years === 10) return 'tenure-10y';
  if (years === 15) return 'tenure-15y';
  return null;
};

const occurredYear = (iso: string): number | null => {
  const d = new Date(iso.length <= 10 && !iso.includes('T') ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
};

const sortCatalogItems = (items: Array<AchievementDef & { earned: boolean }>) =>
  [...items].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

/** Есть ли год, где согласованных billable-дней ≥ 28. */
const hasFullVacationYear = (
  employeeName: string,
  requestsByYear: Record<string, Array<{ employee: string; start: string; end: string; status: string }>>
): boolean => {
  for (const yearKey of Object.keys(requestsByYear)) {
    const requests = requestsByYear[yearKey] || [];
    let approvedDays = 0;
    for (const r of requests) {
      if (r.employee !== employeeName || r.status !== 'approved') continue;
      approvedDays += countVacationBillableDays(r.start, r.end);
    }
    if (approvedDays >= FULL_VACATION_DAYS) return true;
  }
  return false;
};

export function useAchievements() {
  const { user } = useAuth();
  const { findByUserId, findByUserForAuth } = useEmployees();
  const { ideas } = useIdeasBank();
  const { state: vacationState } = useVacations();
  const { serverItems } = useProfileActivity();
  const { revealedCount: salesBestCount, hydrate: hydrateSalesBest, hydrated: salesBestHydrated } =
    useSalesBest();
  const {
    hydrate: hydratePitStopWinners,
    hydrated: pitStopWinnersHydrated,
    hasPitStopAchievement,
    achievementId: pitStopAchievementId
  } = usePitStopWinners();

  if (import.meta.client && !salesBestHydrated.value) {
    void hydrateSalesBest();
  }
  if (import.meta.client && !pitStopWinnersHydrated.value) {
    void hydratePitStopWinners();
  }

  const earnedIds = computed(() => {
    const ids = new Set<string>();
    const uid = user.value?.id;
    if (!uid) return ids;

    if (readVacationTrainingCompleted(uid)) {
      ids.add('kalendar-otpuskov');
    }

    const emp = findByUserForAuth(user.value!) ?? findByUserId(uid);

    // —— Стаж ——
    if (emp?.hired_at) {
      if (yearsOfService(emp.hired_at) >= 1) ids.add('tenure-1y');
    }
    if (emp) {
      const claimed = readCelebrationClaimed();
      for (const years of TENURE_GIFT_YEARS) {
        const key = tenureAnniversaryNotifyKey(emp.id, years, 'claim');
        if (claimed.includes(key)) {
          const achId = tenureAchievementId(years);
          if (achId) ids.add(achId);
        }
      }
    }

    // —— Отпуск 28 дней ——
    if (emp?.name && hasFullVacationYear(emp.name, vacationState.value.requestsByYear)) {
      ids.add('vacation-full-28');
    }

    // —— Идеи ——
    const doneIdeas = ideas.value.filter(
      (idea) => idea.authorUserId === uid && idea.status === 'done'
    ).length;
    for (const id of tierAchievementIds('idea-done', doneIdeas)) ids.add(id);

    // —— Ручная активность (и сиды) ——
    const mine = serverItems.value.filter((row) => {
      if (emp && row.employee_id === emp.id) return true;
      if (row.platform_user_id === uid) return true;
      return false;
    });

    const talks = mine.filter((row) => row.kind === 'talk');
    const talkTotal = talks.length;
    if (talkTotal >= 1) ids.add('talk-first');
    for (const id of tierAchievementIds('talk-total', talkTotal)) ids.add(id);

    const currentYear = new Date().getFullYear();
    const talksThisYear = talks.filter((row) => occurredYear(row.occurred_at) === currentYear).length;
    for (const id of tierAchievementIds('talk-year', talksThisYear)) ids.add(id);

    // Курсы — только ручные/сид learning (не авто-квест отпусков)
    const courses = mine.filter(
      (row) =>
        row.kind === 'learning' &&
        row.source !== 'auto' &&
        !/календарь отпусков|обучен.*отпуск/i.test(row.text)
    ).length;
    for (const id of tierAchievementIds('learning', courses)) ids.add(id);

    const promotions = mine.filter((row) => {
      if (row.kind === 'promotion') return true;
      // legacy seed: повышение как achievement
      return row.kind === 'achievement' && /повышен/i.test(row.text);
    }).length;
    for (const id of tierAchievementIds('promo', promotions)) ids.add(id);

    const mentors = mine.filter((row) => row.kind === 'mentor').length;
    for (const id of tierAchievementIds('mentor', mentors)) ids.add(id);

    const practices = mine.filter((row) => row.kind === 'practice').length;
    for (const id of tierAchievementIds('practice-lead', practices)) ids.add(id);

    // —— Магазин: только покупки каталога + юбилейные заказы (не ручная лента) ——
    const catalogBuys = readStorePurchases(uid).length;
    const giftOrders = emp ? readTenureOrdersCount(uid, emp.id) : 0;
    const storeTotal = catalogBuys + giftOrders;
    for (const id of tierAchievementIds('store', storeTotal)) ids.add(id);

    // —— Лучший специалист продаж (после reveal_on) ——
    for (const id of tierAchievementIds('sales-best', salesBestCount.value)) ids.add(id);

    // —— Pit Stop 14: топ-3 после стопа 10.10 03:00 МСК ——
    if (hasPitStopAchievement(uid)) ids.add(pitStopAchievementId);

    return ids;
  });

  const catalogItems = computed(() =>
    ACHIEVEMENTS_CATALOG.map((a) => ({ ...a, earned: earnedIds.value.has(a.id) }))
  );

  const sortItems = (items: Array<AchievementDef & { earned: boolean }>) =>
    sortCatalogItems(items);

  const catalogForProfile = computed(() => sortItems(catalogItems.value));

  const catalogSectionsForProfile = computed((): AchievementCatalogSection[] =>
    groupAchievementsBySection(catalogForProfile.value)
  );

  /** Превью блока: только полученные; закреплённые (квест) — первыми. Locked — только в оверлее. */
  const catalogForProfilePreview = computed(() => {
    const earned = sortItems(catalogItems.value).filter((a) => a.earned);
    const pinned = earned.filter((a) => a.pinPreviewFirst);
    const rest = earned.filter((a) => !a.pinPreviewFirst);
    return [...pinned, ...rest];
  });

  const profileBadges = computed((): AchievementDef[] =>
    catalogForProfilePreview.value
      .filter((a) => !a.hideFromHeroBadges)
      .slice(0, PROFILE_ACHIEVEMENT_SLOTS)
  );

  const earnedAchievements = computed((): AchievementDef[] =>
    catalogForProfile.value.filter((a) => a.earned)
  );

  const earnedCount = computed(() => earnedIds.value.size);

  return {
    profileBadges,
    earnedAchievements,
    catalogForProfile,
    catalogSectionsForProfile,
    catalogForProfilePreview,
    earnedCount,
    earnedIds
  };
}

/** Записать покупку в каталоге магазина (для ачивок store-*). */
export const recordStorePurchase = (input: {
  userId: number;
  itemId: number | string;
  itemName: string;
}): void => {
  if (!import.meta.client || !input.userId) return;
  try {
    const raw = localStorage.getItem(STORE_PURCHASES_KEY);
    const parsed = raw ? (JSON.parse(raw) as { purchases?: StorePurchase[] }) : {};
    const purchases = Array.isArray(parsed.purchases) ? parsed.purchases : [];
    purchases.push({
      id: `store-${input.userId}-${input.itemId}-${Date.now()}`,
      userId: input.userId,
      itemId: input.itemId,
      itemName: input.itemName,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(STORE_PURCHASES_KEY, JSON.stringify({ purchases }));
  } catch {
    /* ignore */
  }
};
