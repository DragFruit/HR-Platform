import {
  TENURE_GIFT_SETS,
  TENURE_GIFT_YEARS,
  isAnniversaryToday,
  tenureAnniversaryNotifyKey,
  type TenureGiftSet,
  type TenureGiftYears
} from '~/utils/tenureAnniversary';

const STORAGE_KEY = 'vbi-tenure-celebration-v1';

type TenureCelebrationPhase = 'idle' | 'letter' | 'achievement' | 'gift' | 'coupon';

type StorageShape = {
  claimed: string[];
};

const readStorage = (): StorageShape => {
  if (!import.meta.client) return { claimed: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { claimed: [] };
    const parsed = JSON.parse(raw) as Partial<StorageShape>;
    return { claimed: Array.isArray(parsed.claimed) ? parsed.claimed : [] };
  } catch {
    return { claimed: [] };
  }
};

const writeStorage = (data: StorageShape) => {
  if (!import.meta.client) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const isClaimed = (key: string) => readStorage().claimed.includes(key);

export function useTenureCelebration() {
  const { user } = useAuth();
  const { findByUserId, findByUserForAuth } = useEmployees();

  const phase = useState<TenureCelebrationPhase>('tenure-celeb-phase', () => 'idle');
  const activeYears = useState<TenureGiftYears | null>('tenure-celeb-years', () => null);
  const employeeId = useState<number | null>('tenure-celeb-emp-id', () => null);

  const isActive = computed(() => phase.value !== 'idle' && activeYears.value != null);

  const giftSet = computed<TenureGiftSet | null>(() => {
    const y = activeYears.value;
    return y ? TENURE_GIFT_SETS[y] : null;
  });

  const claimKey = computed(() => {
    if (!employeeId.value || !activeYears.value) return null;
    return tenureAnniversaryNotifyKey(employeeId.value, activeYears.value, 'claim');
  });

  const evaluate = () => {
    if (!import.meta.client) return;
    if (!user.value) {
      phase.value = 'idle';
      activeYears.value = null;
      employeeId.value = null;
      return;
    }

    const emp = findByUserForAuth(user.value) ?? findByUserId(user.value.id);
    if (!emp?.hired_at?.trim()) {
      phase.value = 'idle';
      return;
    }

    /** Тестовый юбиляр — всегда «сегодня 5 лет», пока не забрал. */
    const forceTestJubilee = emp.id === 9100 || user.value.email?.toLowerCase() === 'jubilee@vbi.local';

    for (const years of TENURE_GIFT_YEARS) {
      const dueToday = forceTestJubilee
        ? years === 5
        : isAnniversaryToday(emp.hired_at, years);
      if (!dueToday) continue;
      const key = tenureAnniversaryNotifyKey(emp.id, years, 'claim');
      if (isClaimed(key)) continue;
      employeeId.value = emp.id;
      activeYears.value = years;
      if (phase.value === 'idle') phase.value = 'letter';
      return;
    }

    phase.value = 'idle';
    activeYears.value = null;
    employeeId.value = null;
  };

  const advanceFromLetter = () => {
    if (phase.value === 'letter') phase.value = 'achievement';
  };

  const advanceFromAchievement = () => {
    if (phase.value === 'achievement') phase.value = 'gift';
  };

  const openGift = () => {
    if (phase.value !== 'gift') return;
    phase.value = 'coupon';
    if (user.value && employeeId.value && activeYears.value) {
      useTenureCoupons().grantCoupon({
        userId: user.value.id,
        employeeId: employeeId.value,
        years: activeYears.value
      });
    }
  };

  const finish = () => {
    const key = claimKey.value;
    if (key) {
      const store = readStorage();
      if (!store.claimed.includes(key)) {
        store.claimed.push(key);
        writeStorage(store);
      }
    }
    if (user.value && employeeId.value && activeYears.value) {
      useTenureCoupons().grantCoupon({
        userId: user.value.id,
        employeeId: employeeId.value,
        years: activeYears.value
      });
    }
    phase.value = 'idle';
    activeYears.value = null;
    employeeId.value = null;
  };

  /** Для повторного теста: сбросить claim текущего юбилея. */
  const resetClaimForTest = () => {
    const emp = user.value ? findByUserForAuth(user.value) ?? findByUserId(user.value.id) : null;
    if (!emp) return;
    const store = readStorage();
    store.claimed = store.claimed.filter((k) => !k.includes(`tenure-anniversary-${emp.id}-`));
    writeStorage(store);
    evaluate();
  };

  const resetSessionUi = () => {
    phase.value = 'idle';
    activeYears.value = null;
    employeeId.value = null;
  };

  return {
    phase,
    activeYears,
    giftSet,
    isActive,
    evaluate,
    advanceFromLetter,
    advanceFromAchievement,
    openGift,
    finish,
    resetClaimForTest,
    resetSessionUi
  };
}
