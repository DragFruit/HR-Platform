import { POST_VACATION_MEMO_SLIDES } from '~/data/postVacationMemoSlides';
import { findPostVacationMemoRequest } from '~/utils/postVacationMemo';
import { todayIso } from '~/utils/vacationCalendar';

const STORAGE_KEY = 'vbi-post-vacation-memo-v1';

type SeenMap = Record<string, number[]>;

const readSeen = (userId: number): Set<number> => {
  if (!import.meta.client) return new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as SeenMap;
    return new Set(raw[String(userId)] ?? []);
  } catch {
    return new Set();
  }
};

const writeSeen = (userId: number, ids: Set<number>) => {
  if (!import.meta.client) return;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as SeenMap;
    raw[String(userId)] = [...ids];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  } catch {
    /* ignore */
  }
};

export function usePostVacationMemo() {
  const { user, showOnboarding, isAuthenticated } = useAuth();
  const { findByUserForAuth } = useEmployees();
  const { state } = useVacations();
  const { isActive: tenureCelebrationActive } = useTenureCelebration();
  const { isProduction } = useAppEnv();
  const route = useRoute();

  const index = ref(0);
  const dismissed = ref(false);

  const forcePreview = computed(() => {
    if (isProduction.value) return false;
    const q = route.query.pvm;
    const raw = Array.isArray(q) ? q[0] : q;
    return String(raw || '') === '1';
  });

  const employeeName = computed(() => {
    const me = findByUserForAuth(user.value);
    return (me?.name || user.value?.name || '').trim();
  });

  const allRequests = computed(() => Object.values(state.value.requestsByYear).flat());

  const eligibleRequest = computed(() => {
    if (!import.meta.client || !isAuthenticated.value || !user.value) return null;
    if (showOnboarding.value || tenureCelebrationActive.value || dismissed.value) return null;
    if (forcePreview.value) {
      return {
        id: 0,
        employee: employeeName.value,
        start: '2026-07-01',
        end: '2026-07-14',
        status: 'approved' as const,
        comment: '',
        createdAt: ''
      };
    }
    return findPostVacationMemoRequest(
      allRequests.value,
      employeeName.value,
      todayIso(),
      readSeen(user.value.id)
    );
  });

  const isOpen = computed(() => Boolean(eligibleRequest.value));

  const slides = POST_VACATION_MEMO_SLIDES;
  const slide = computed(() => slides[index.value] ?? slides[0]);
  const isLast = computed(() => index.value >= slides.length - 1);

  const markSeen = () => {
    const req = eligibleRequest.value;
    if (!user.value || !req || req.id === 0) return;
    const seen = readSeen(user.value.id);
    seen.add(req.id);
    writeSeen(user.value.id, seen);
  };

  const next = () => {
    if (isLast.value) {
      markSeen();
      dismissed.value = true;
      index.value = 0;
      return;
    }
    index.value += 1;
  };

  const close = () => {
    markSeen();
    dismissed.value = true;
    index.value = 0;
  };

  watch(isOpen, (open) => {
    if (open) index.value = 0;
  });

  return {
    isOpen,
    slide,
    index,
    slides,
    isLast,
    next,
    close
  };
}
