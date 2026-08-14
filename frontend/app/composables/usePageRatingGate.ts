import {
  PAGE_RATING_DWELL_MS,
  pageRatingEligibleFromMs,
  pageRatingPeriodIndex,
  resolvePageRatingSection,
  type PageRatingSection
} from '~/utils/pageRatingSections';

const STORAGE_KEY = 'vbi-page-rating-gate-v1';
const LEGACY_KB_KEY = 'vbi-kb-page-rating-v1';
const TICK_MS = 10_000;

type GateState = {
  version: 1;
  userId: number;
  dwellMs: Record<string, number>;
  /** Индекс периода, в котором уже отправили оценку */
  ratedPeriodId: number | null;
  /** Индекс периода, в котором кот уже показывался (даже без отправки) */
  shownPeriodId: number | null;
};

function emptyState(userId: number): GateState {
  return { version: 1, userId, dwellMs: {}, ratedPeriodId: null, shownPeriodId: null };
}

function readState(userId: number): GateState {
  if (!import.meta.client || userId <= 0) return emptyState(userId);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GateState;
      if (parsed?.version === 1 && parsed.userId === userId && parsed.dwellMs) {
        return {
          version: 1,
          userId,
          dwellMs: { ...parsed.dwellMs },
          ratedPeriodId: typeof parsed.ratedPeriodId === 'number' ? parsed.ratedPeriodId : null,
          shownPeriodId: typeof parsed.shownPeriodId === 'number' ? parsed.shownPeriodId : null
        };
      }
    }
  } catch {
    /* ignore */
  }

  // Миграция: старая одноразовая оценка базы знаний = уже оценил текущий период
  try {
    if (localStorage.getItem(LEGACY_KB_KEY)) {
      const migrated = emptyState(userId);
      const period = pageRatingPeriodIndex();
      migrated.ratedPeriodId = period;
      migrated.shownPeriodId = period;
      migrated.dwellMs['/knowledge'] = PAGE_RATING_DWELL_MS;
      writeState(migrated);
      return migrated;
    }
  } catch {
    /* ignore */
  }

  return emptyState(userId);
}

function writeState(state: GateState) {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/**
 * Кот оценки: раз в ~2 месяца на пользователя, день свой (hash),
 * только в разделе с суммарным временем ≥ 1 ч.
 */
export function usePageRatingGate() {
  const { user } = useAuth();
  const { isPathAllowed } = useLaunchScope();

  const userId = computed(() => Number(user.value?.id) || 0);

  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let activeSectionPath: string | null = null;
  let lastPersist = 0;

  const stopDwell = () => {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    activeSectionPath = null;
  };

  const bumpDwell = (sectionPath: string, deltaMs: number) => {
    const id = userId.value;
    if (id <= 0 || deltaMs <= 0) return;
    const state = readState(id);
    state.dwellMs[sectionPath] = (state.dwellMs[sectionPath] || 0) + deltaMs;
    writeState(state);
  };

  const startDwell = (section: PageRatingSection | null) => {
    stopDwell();
    if (!import.meta.client || !section || userId.value <= 0) return;
    if (!isPathAllowed(section.path)) return;
    activeSectionPath = section.path;
    tickTimer = setInterval(() => {
      if (!activeSectionPath) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      bumpDwell(activeSectionPath, TICK_MS);
      lastPersist = Date.now();
    }, TICK_MS);
  };

  const dwellMsFor = (sectionPath: string) => {
    const id = userId.value;
    if (id <= 0) return 0;
    return readState(id).dwellMs[sectionPath] || 0;
  };

  const hasRatedThisPeriod = () => {
    const id = userId.value;
    if (id <= 0) return true;
    const state = readState(id);
    const period = pageRatingPeriodIndex();
    return state.ratedPeriodId === period || state.shownPeriodId === period;
  };

  const markShownThisPeriod = () => {
    const id = userId.value;
    if (id <= 0) return;
    const state = readState(id);
    state.shownPeriodId = pageRatingPeriodIndex();
    writeState(state);
  };

  const markRatedThisPeriod = () => {
    const id = userId.value;
    if (id <= 0) return;
    const state = readState(id);
    const period = pageRatingPeriodIndex();
    state.ratedPeriodId = period;
    state.shownPeriodId = period;
    writeState(state);
    try {
      localStorage.setItem(
        LEGACY_KB_KEY,
        JSON.stringify({ at: new Date().toISOString(), migrated: true })
      );
    } catch {
      /* ignore */
    }
  };

  /** Можно показать кота в этом разделе прямо сейчас. */
  const canShowCat = (section: PageRatingSection | null) => {
    if (!import.meta.client || !section) return false;
    const id = userId.value;
    if (id <= 0) return false;
    if (!isPathAllowed(section.path)) return false;
    if (hasRatedThisPeriod()) return false;
    if (dwellMsFor(section.path) < PAGE_RATING_DWELL_MS) return false;
    const period = pageRatingPeriodIndex();
    if (Date.now() < pageRatingEligibleFromMs(id, period)) return false;
    return true;
  };

  const sectionForRoute = (path: string) => {
    const section = resolvePageRatingSection(path);
    if (!section) return null;
    if (!isPathAllowed(section.path)) return null;
    return section;
  };

  onBeforeUnmount(() => {
    stopDwell();
    void lastPersist;
  });

  return {
    startDwell,
    stopDwell,
    canShowCat,
    markShownThisPeriod,
    markRatedThisPeriod,
    hasRatedThisPeriod,
    dwellMsFor,
    sectionForRoute
  };
}
