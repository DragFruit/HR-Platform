import {
  POST_VACATION_DOCK,
  POST_VACATION_MEMO_SLIDES,
  POST_VACATION_WELCOME
} from '~/data/postVacationMemoSlides';
import {
  buildDockedRecord,
  findDockedMemoRequestId,
  findPostVacationMemoRequest,
  listKnownMemoRequestIds,
  readMemoRecord,
  writeMemoRecord
} from '~/utils/postVacationMemo';
import {
  clearPostVacationMemoPreview,
  isPostVacationMemoPreview
} from '~/utils/postVacationMemoPreview';
import { todayIso } from '~/utils/vacationCalendar';

export type PvmUi = 'hidden' | 'welcome' | 'collapsing' | 'flying' | 'docked' | 'carousel';

const PREVIEW_REQUEST_ID = 0;

export function usePostVacationMemo() {
  const { user, showOnboarding, isAuthenticated } = useAuth();
  const { findByUserForAuth } = useEmployees();
  const { state } = useVacations();
  const { isActive: tenureCelebrationActive } = useTenureCelebration();
  const route = useRoute();
  const router = useRouter();

  const ui = useState<PvmUi>('pvm-ui', () => 'hidden');
  const index = useState<number>('pvm-index', () => 0);
  const requestId = useState<number>('pvm-request-id', () => 0);

  const forcePreview = computed(() => {
    void route.fullPath;
    return isPostVacationMemoPreview();
  });

  const openTipsQuery = computed(() => {
    const q = route.query.pvm;
    const raw = Array.isArray(q) ? q[0] : q;
    return String(raw || '') === 'tips';
  });

  const employeeName = computed(() => {
    const me = findByUserForAuth(user.value);
    return (me?.name || user.value?.name || '').trim();
  });

  const allRequests = computed(() => Object.values(state.value.requestsByYear).flat());

  const welcomeRequest = computed(() => {
    if (!import.meta.client || !isAuthenticated.value || !user.value) return null;
    if (forcePreview.value) {
      return {
        id: PREVIEW_REQUEST_ID,
        employee: employeeName.value,
        start: '2026-07-01',
        end: '2026-07-14',
        status: 'approved' as const,
        comment: '',
        createdAt: ''
      };
    }
    if (showOnboarding.value || tenureCelebrationActive.value) return null;
    return findPostVacationMemoRequest(
      allRequests.value,
      employeeName.value,
      todayIso(),
      listKnownMemoRequestIds(user.value.id)
    );
  });

  const slides = POST_VACATION_MEMO_SLIDES;
  const welcome = POST_VACATION_WELCOME;
  const dockCopy = POST_VACATION_DOCK;
  const slide = computed(() => slides[index.value] ?? slides[0]);
  const isLast = computed(() => index.value >= slides.length - 1);

  const persistDocked = (id: number) => {
    if (!user.value || id === PREVIEW_REQUEST_ID) return;
    writeMemoRecord(user.value.id, buildDockedRecord(id));
  };

  const persistDone = (id: number) => {
    if (!user.value || id === PREVIEW_REQUEST_ID) return;
    const prev = readMemoRecord(user.value.id, id);
    writeMemoRecord(user.value.id, {
      requestId: id,
      phase: 'done',
      thanksAt: prev?.thanksAt || todayIso(),
      dockExpires: prev?.dockExpires || todayIso()
    });
  };

  const ensureNotification = async (id: number) => {
    if (id === PREVIEW_REQUEST_ID) return;
    try {
      await $fetch('/api/notifications/post-vacation-memo', {
        method: 'POST',
        body: { vacation_request_id: id }
      });
      await useUserNotifications().loadNotifications().catch(() => {});
    } catch {
      /* колокольчик не критичен для чипа */
    }
  };

  const showWelcome = (id: number) => {
    requestId.value = id;
    index.value = 0;
    ui.value = 'welcome';
  };

  const showDocked = (id: number) => {
    requestId.value = id;
    ui.value = 'docked';
  };

  const openCarousel = () => {
    index.value = 0;
    ui.value = 'carousel';
  };

  const sayThanks = async () => {
    ui.value = 'collapsing';
    persistDocked(requestId.value);
    void ensureNotification(requestId.value);
  };

  const finishFly = () => {
    ui.value = 'docked';
  };

  const completeCarousel = () => {
    persistDone(requestId.value);
    if (forcePreview.value) clearPostVacationMemoPreview();
    index.value = 0;
    ui.value = 'hidden';
    if (openTipsQuery.value) {
      const { pvm: _pvm, ...rest } = route.query;
      void router.replace({ path: route.path, query: rest });
    }
  };

  const next = () => {
    if (isLast.value) {
      completeCarousel();
      return;
    }
    index.value += 1;
  };

  const prev = () => {
    if (index.value <= 0) return;
    index.value -= 1;
  };

  const hydrate = () => {
    if (!import.meta.client || !user.value) return;
    if (openTipsQuery.value) {
      const dockedId = findDockedMemoRequestId(user.value.id);
      requestId.value = dockedId ?? requestId.value;
      openCarousel();
      return;
    }
    if (forcePreview.value) {
      showWelcome(PREVIEW_REQUEST_ID);
      return;
    }
    if (showOnboarding.value || tenureCelebrationActive.value) {
      ui.value = 'hidden';
      return;
    }
    const dockedId = findDockedMemoRequestId(user.value.id);
    if (dockedId != null) {
      showDocked(dockedId);
      return;
    }
    const welcomeReq = welcomeRequest.value;
    if (welcomeReq) {
      showWelcome(welcomeReq.id);
      return;
    }
    ui.value = 'hidden';
  };

  watch(
    () => [
      isAuthenticated.value,
      user.value?.id,
      forcePreview.value,
      openTipsQuery.value,
      showOnboarding.value,
      tenureCelebrationActive.value,
      welcomeRequest.value?.id
    ],
    () => {
      if (openTipsQuery.value) {
        if (user.value) {
          const dockedId = findDockedMemoRequestId(user.value.id);
          if (dockedId != null) requestId.value = dockedId;
        }
        if (ui.value !== 'carousel') openCarousel();
        return;
      }
      if (ui.value === 'collapsing' || ui.value === 'flying' || ui.value === 'docked' || ui.value === 'carousel') {
        return;
      }
      hydrate();
    },
    { immediate: true }
  );

  return {
    ui,
    welcome,
    dockCopy,
    slides,
    slide,
    index,
    isLast,
    requestId,
    sayThanks,
    finishFly,
    openCarousel,
    next,
    prev
  };
}
