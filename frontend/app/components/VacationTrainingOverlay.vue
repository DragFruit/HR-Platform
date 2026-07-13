<template>
  <Teleport to="body">
    <div v-if="isActive && currentStep" class="vac-training-overlay" role="presentation">
      <div
        v-if="spotlightLayout"
        class="vac-training-overlay__scrim vac-training-overlay__scrim--spotlight"
        :style="spotlightLayout.style"
        aria-hidden="true"
      />
      <div v-else class="vac-training-overlay__scrim" aria-hidden="true" />

      <img
        v-if="markerLayout && currentStep.kind === 'outline'"
        :key="`marker-${currentStep.id}`"
        :src="markerLayout.src"
        class="vac-training-marker"
        :style="markerLayout.style"
        alt=""
      />

      <svg
        v-if="underlineLayout && currentStep.kind === 'underline'"
        :key="`underline-${currentStep.id}`"
        class="vac-training-underline"
        :style="underlineLayout.style"
        :viewBox="`0 0 ${underlineLayout.width} ${underlineLayout.height}`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            :id="underlineGradientId"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stop-color="#fb7185" />
            <stop offset="45%" stop-color="#f472b6" />
            <stop offset="100%" stop-color="#db2777" />
          </linearGradient>
        </defs>
        <path
          class="vac-training-underline__path"
          :d="underlineLayout.path"
          pathLength="1"
          fill="none"
          :stroke="`url(#${underlineGradientId})`"
          stroke-width="2.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>

      <svg
        v-if="circleLayout && currentStep.kind === 'circle'"
        :key="`circle-${currentStep.id}`"
        class="vac-training-circle"
        :style="circleLayout.style"
        :viewBox="`0 0 ${circleLayout.width} ${circleLayout.height}`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            :id="circleGradientId"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stop-color="#fb7185" />
            <stop offset="45%" stop-color="#f472b6" />
            <stop offset="100%" stop-color="#db2777" />
          </linearGradient>
        </defs>
        <path
          class="vac-training-circle__path"
          :d="circleLayout.path"
          pathLength="1"
          fill="none"
          :stroke="`url(#${circleGradientId})`"
          stroke-width="2.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>

      <div
        v-if="showRewardReveal"
        class="vac-training-reward vac-training-overlay__layer"
        :class="{ 'vac-training-reward--close-ready': showRewardClose }"
        role="dialog"
        aria-labelledby="vac-training-reward-title"
        aria-modal="true"
      >
        <div class="vac-training-reward__backdrop" aria-hidden="true" />

        <div class="vac-training-reward__content">
          <div class="vac-training-reward__badge-wrap">
            <img
              class="vac-training-reward__badge"
              :src="trainingAchievement.imageSrc"
              :alt="`Ачивка: ${trainingAchievement.title}`"
              width="300"
              height="300"
            />
          </div>

          <div class="vac-training-reward__caption">
            <h2 id="vac-training-reward-title" class="vac-training-reward__title">
              {{ trainingAchievement.title }}
            </h2>
            <p class="vac-training-reward__subtitle">{{ trainingAchievement.subtitle }}</p>
          </div>

          <button
            type="button"
            class="vac-training-reward__close"
            @click="dismissReward"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>

    <article
      v-if="isActive && currentStep && !showRewardReveal"
      ref="cardRef"
      class="vac-training-overlay__card vac-training-overlay__layer"
      role="dialog"
      aria-labelledby="vac-training-step-title"
      :style="cardStyle"
    >
      <p class="vac-training-overlay__progress">{{ progressLabel }}</p>
      <h3 id="vac-training-step-title" class="vac-training-overlay__title">{{ currentStep.title }}</h3>

      <template v-if="currentStep.id === 'warnings'">
        <ul class="vac-training-warnings list-reset">
          <li v-for="item in warningItems" :key="item.title" class="vac-training-warnings__item">
            <span :class="['vac-training-warnings__badge', item.badgeClass]">{{ item.title }}</span>
            <span class="vac-training-warnings__desc">{{ item.text }}</span>
          </li>
        </ul>
      </template>
      <template v-else-if="currentStep.id === 'requests'">
        <p class="vac-training-overlay__text">{{ currentStep.text }}</p>
        <div class="vac-training-status emp-request-meta">
          <span
            v-for="item in requestStatusItems"
            :key="item.status"
            class="pill"
            :class="item.status"
          >
            {{ item.title }}
          </span>
        </div>
        <p v-if="!isRetakeMode" class="vac-training-overlay__reward-hint muted">
          Отлично! Теперь вы знаете, как пользоваться Графиком отпусков.
        </p>
      </template>
      <p v-else class="vac-training-overlay__text">{{ currentStep.text }}</p>

      <div v-if="showAcknowledge" class="vac-training-overlay__footer">
        <div class="vac-training-overlay__nav">
          <button
            type="button"
            class="vac-training-overlay__nav-btn vac-training-overlay__nav-btn--back"
            :disabled="stepIndex === 0"
            @click="goPrevStep"
          >
            Назад
          </button>

          <button
            v-if="isLastStep && isRetakeMode"
            type="button"
            class="vac-training-overlay__nav-btn vac-training-overlay__nav-btn--next"
            @click="onAcknowledge"
          >
            Завершить
          </button>
          <button
            v-else-if="isLastStep"
            type="button"
            class="vac-training-overlay__reward-btn"
            @click="onAcknowledge"
          >
            Получить награду
          </button>
          <button
            v-else
            type="button"
            class="vac-training-overlay__nav-btn vac-training-overlay__nav-btn--next"
            @click="onAcknowledge"
          >
            Продолжить
          </button>
        </div>
      </div>
      <div v-else class="vac-training-overlay__footer">
        <div class="vac-training-overlay__nav vac-training-overlay__nav--hint">
          <button
            type="button"
            class="vac-training-overlay__nav-btn vac-training-overlay__nav-btn--back"
            :disabled="stepIndex === 0"
            @click="goPrevStep"
          >
            Назад
          </button>
          <p class="vac-training-overlay__hint muted">Выполните действие на экране ↑</p>
        </div>
      </div>
    </article>
  </Teleport>
</template>

<script setup lang="ts">
import {
  VACATION_TRAINING_ACHIEVEMENT,
  VACATION_TRAINING_REQUEST_STATUS_ITEMS,
  VACATION_TRAINING_WARNING_ITEMS
} from '~/data/vacationTrainingQuest';
import {
  MARKER_RING_SRC,
  buildHandCirclePath,
  buildHandUnderlinePath,
  markerPaddingForStep,
  measureBalanceValueRect,
  measureCreateToolbarUnderlineRect,
  measureProjectionSummaryRect,
  measureRequestsHeadingRect,
  measureReservationsClarifyRect,
  pickMarkerAsset
} from '~/utils/vacationTrainingMarkerAssets';

const {
  isActive,
  isRetakeMode,
  currentStep,
  stepIndex,
  totalSteps,
  progressLabel,
  acknowledgeStep,
  finishTraining,
  goPrevStep,
  canClaimVacationAchievement
} = useVacationTraining();

const warningItems = VACATION_TRAINING_WARNING_ITEMS;
const requestStatusItems = VACATION_TRAINING_REQUEST_STATUS_ITEMS;
const trainingAchievement = VACATION_TRAINING_ACHIEVEMENT;

const TARGET_ACTIVE_CLASS = 'vac-training-target--active';
const CARD_WIDTH = 340;
const CARD_EST_HEIGHT = 220;
const VIEWPORT_MARGIN = 16;
const FOOTER_RESERVE = 88;
const SPOTLIGHT_PAD = 6;

const targetRect = ref<DOMRect | null>(null);
const cardStyle = ref<Record<string, string>>({});
const cardRef = ref<HTMLElement | null>(null);
const showRewardReveal = ref(false);
const showRewardClose = ref(false);
let rewardCloseTimer: ReturnType<typeof setTimeout> | null = null;

const showAcknowledge = computed(() => currentStep.value?.action === 'acknowledge');
const isLastStep = computed(() => stepIndex.value >= totalSteps.value - 1);

const isInteractiveStep = (step: { action?: string }) =>
  step.action === 'calendar-range' ||
  step.action === 'create-request' ||
  step.action === 'create-reservation';

const shouldSpotlightTarget = (step: { id?: string; target?: string | null; action?: string }) => {
  if (!step.target) return false;
  if (isInteractiveStep(step)) return true;
  return (
    step.id === 'balance' ||
    step.id === 'projection' ||
    step.id === 'manage-request' ||
    step.id === 'reservation-clarify' ||
    step.id === 'requests'
  );
};

const clearActiveTarget = () => {
  document.querySelectorAll(`[data-tour].${TARGET_ACTIVE_CLASS}`).forEach((el) => {
    el.classList.remove(TARGET_ACTIVE_CLASS);
  });
};

const syncActiveTarget = () => {
  clearActiveTarget();
  const step = currentStep.value;
  if (!step?.target || !shouldSpotlightTarget(step)) return;
  document.querySelector(`[data-tour="${step.target}"]`)?.classList.add(TARGET_ACTIVE_CLASS);
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const measureCardHeight = () => cardRef.value?.offsetHeight ?? CARD_EST_HEIGHT;

const cardOverlapsRect = (
  left: number,
  top: number,
  width: number,
  height: number,
  rect: DOMRect,
  pad = 10
) => {
  const cardRight = left + width;
  const cardBottom = top + height;
  const targetLeft = rect.left - pad;
  const targetTop = rect.top - pad;
  const targetRight = rect.right + pad;
  const targetBottom = rect.bottom + pad;
  return (
    left < targetRight &&
    cardRight > targetLeft &&
    top < targetBottom &&
    cardBottom > targetTop
  );
};

const placeAvoidingTarget = (targetRect: DOMRect, cardWidth = CARD_WIDTH) => {
  const cardHeight = measureCardHeight();
  const gap = 16;

  const candidates = [
    {
      left: targetRect.left - cardWidth - gap,
      top: targetRect.top + targetRect.height / 2 - cardHeight / 2
    },
    {
      left: targetRect.left - cardWidth - gap,
      top: targetRect.top - cardHeight - gap
    },
    {
      left: targetRect.left + targetRect.width / 2 - cardWidth / 2,
      top: targetRect.top - cardHeight - gap
    },
    {
      left: targetRect.left + targetRect.width / 2 - cardWidth / 2,
      top: targetRect.bottom + gap
    },
    {
      left: targetRect.right + gap,
      top: targetRect.top + targetRect.height / 2 - cardHeight / 2
    }
  ];

  for (const candidate of candidates) {
    const left = clamp(
      candidate.left,
      VIEWPORT_MARGIN,
      window.innerWidth - cardWidth - VIEWPORT_MARGIN
    );
    const top = clamp(
      candidate.top,
      VIEWPORT_MARGIN,
      window.innerHeight - cardHeight - FOOTER_RESERVE
    );
    if (!cardOverlapsRect(left, top, cardWidth, cardHeight, targetRect)) {
      return { left, top };
    }
  }

  const calendarRect = document.querySelector('[data-tour="vac-calendar"]')?.getBoundingClientRect();
  if (calendarRect) {
    const left = calendarRect.left + gap;
    const top = calendarRect.top + gap;
    if (!cardOverlapsRect(left, top, cardWidth, cardHeight, targetRect)) {
      return { left, top };
    }
  }

  return {
    left: clamp(
      targetRect.left - cardWidth - gap,
      VIEWPORT_MARGIN,
      window.innerWidth - cardWidth - VIEWPORT_MARGIN
    ),
    top: clamp(
      targetRect.top - cardHeight - gap,
      VIEWPORT_MARGIN,
      window.innerHeight - cardHeight - FOOTER_RESERVE
    )
  };
};

const placeReservationBookCard = (targetRect: DOMRect) => {
  const { left, top } = placeAvoidingTarget(targetRect);

  cardStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${CARD_WIDTH}px`,
    maxWidth: `min(${CARD_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`,
    transform: 'none'
  };
};

/** Карточка поверх календаря (шаг 6): ~⅓ ширины за левым краем календаря */
const placeCalendarStepCard = (calendarRect: DOMRect) => {
  const cardHeight = measureCardHeight();
  const gap = 12;

  let left = calendarRect.left - CARD_WIDTH / 3;
  let top = calendarRect.top + gap;

  const toolbarRect = document.querySelector('[data-tour="vac-create-form"]')?.getBoundingClientRect();
  if (toolbarRect) {
    top = toolbarRect.bottom + gap;
  }

  left = clamp(left, VIEWPORT_MARGIN, window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN);
  top = clamp(top, VIEWPORT_MARGIN, window.innerHeight - cardHeight - FOOTER_RESERVE);

  cardStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${CARD_WIDTH}px`,
    maxWidth: `min(${CARD_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`,
    transform: 'none'
  };
};

const placeAsideQuestCard = (targetRect: DOMRect) => {
  const aside = document.querySelector('.employee-aside:not(.employee-aside--embedded)');
  const asideRect = aside?.getBoundingClientRect();
  const cardHeight = measureCardHeight();

  if (asideRect) {
    const left = clamp(
      asideRect.left - CARD_WIDTH - 20,
      VIEWPORT_MARGIN,
      window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN
    );
    let top = targetRect.top;
    const maxTop = window.innerHeight - cardHeight - FOOTER_RESERVE;
    top = clamp(top, VIEWPORT_MARGIN, maxTop);

    cardStyle.value = {
      top: `${top}px`,
      left: `${left}px`,
      width: `${CARD_WIDTH}px`,
      maxWidth: `min(${CARD_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`,
      transform: 'none'
    };
    return;
  }

  placeDefaultCard(targetRect);
};

const placeBalanceCard = (balanceRect: DOMRect) => {
  placeAsideQuestCard(balanceRect);
};

const placeProjectionCard = (projectionRect: DOMRect) => {
  placeAsideQuestCard(projectionRect);
};

const placeRequestsCard = (rect: DOMRect) => {
  const aside = document.querySelector('.employee-aside:not(.employee-aside--embedded)');
  const asideRect = aside?.getBoundingClientRect();
  const cardHeight = measureCardHeight();

  if (asideRect) {
    const left = clamp(
      asideRect.left - CARD_WIDTH - 20,
      VIEWPORT_MARGIN,
      window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN
    );
    let top = rect.top;
    const maxTop = window.innerHeight - cardHeight - FOOTER_RESERVE;
    top = clamp(top, VIEWPORT_MARGIN, maxTop);

    cardStyle.value = {
      top: `${top}px`,
      left: `${left}px`,
      width: `${CARD_WIDTH}px`,
      maxWidth: `min(${CARD_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`,
      transform: 'none'
    };
    return;
  }

  placeDefaultCard(rect);
};

const placeReservationsCard = (rect: DOMRect) => {
  placeRequestsCard(rect);
};

const placeDefaultCard = (rect: DOMRect) => {
  const cardHeight = measureCardHeight();
  const cardTop = clamp(rect.bottom + 16, VIEWPORT_MARGIN, window.innerHeight - cardHeight - FOOTER_RESERVE);
  const cardLeft = clamp(rect.left, VIEWPORT_MARGIN, window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN);

  cardStyle.value = {
    top: `${cardTop}px`,
    left: `${cardLeft}px`,
    maxWidth: `min(${CARD_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`,
    transform: 'none'
  };
};

const updateGeometry = () => {
  const step = currentStep.value;
  if (!step?.target) {
    targetRect.value = null;
    cardStyle.value = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: 'min(420px, 92vw)'
    };
    return;
  }

  const el = document.querySelector(`[data-tour="${step.target}"]`);
  if (!el) {
    targetRect.value = null;
    cardStyle.value = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: `${CARD_WIDTH}px`,
      maxWidth: `min(${CARD_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`
    };
    return;
  }

  const rect = el.getBoundingClientRect();
  targetRect.value = rect;

  if (step.id === 'balance') {
    placeBalanceCard(rect);
    return;
  }

  if (step.id === 'projection') {
    placeProjectionCard(rect);
    return;
  }

  if (step.id === 'manage-request' || step.id === 'requests') {
    placeRequestsCard(rect);
    return;
  }

  if (step.id === 'reservation-clarify') {
    placeReservationsCard(measureReservationsClarifyRect() ?? rect);
    return;
  }

  if (step.id === 'reservation-book') {
    placeReservationBookCard(rect);
    return;
  }

  if (step.id === 'calendar') {
    placeCalendarStepCard(
      document.querySelector('[data-tour="vac-calendar"]')?.getBoundingClientRect() ?? rect
    );
    return;
  }

  placeDefaultCard(rect);
};

const markerLayout = computed(() => {
  const rect = targetRect.value;
  const step = currentStep.value;
  if (!rect || !step || step.kind !== 'outline') return null;

  const pad = markerPaddingForStep(step.id);
  const asset = pickMarkerAsset(rect);

  return {
    src: MARKER_RING_SRC[asset],
    style: {
      top: `${rect.top - pad.y}px`,
      left: `${rect.left - pad.x}px`,
      width: `${rect.width + pad.x * 2}px`,
      height: `${rect.height + pad.y * 2}px`
    }
  };
});

const underlineGradientId = computed(
  () => `vac-training-underline-grad-${currentStep.value?.id ?? 'step'}`
);

const circleGradientId = computed(
  () => `vac-training-circle-grad-${currentStep.value?.id ?? 'step'}`
);

const spotlightLayout = computed(() => {
  const step = currentStep.value;
  if (!step || !shouldSpotlightTarget(step)) return null;

  const rect =
    step.id === 'projection'
      ? measureProjectionSummaryRect() ?? targetRect.value
      : step.id === 'manage-request'
        ? measureRequestsHeadingRect() ?? targetRect.value
        : step.id === 'reservation-clarify'
          ? measureReservationsClarifyRect() ?? targetRect.value
          : targetRect.value;
  if (!rect) return null;

  const pad = SPOTLIGHT_PAD;
  const radiusByStep: Record<string, string> = {
    balance: '12px',
    projection: '6px',
    'manage-request': '10px',
    'reservation-book': '8px',
    'reservation-clarify': '10px',
    calendar: '10px',
    requests: '10px'
  };

  return {
    style: {
      top: `${rect.top - pad}px`,
      left: `${rect.left - pad}px`,
      width: `${rect.width + pad * 2}px`,
      height: `${rect.height + pad * 2}px`,
      borderRadius: radiusByStep[step.id] ?? '10px'
    }
  };
});

const circleLayout = computed(() => {
  const step = currentStep.value;
  if (!step || step.kind !== 'circle') return null;

  const rect = step.id === 'balance' ? measureBalanceValueRect() : targetRect.value;
  if (!rect) return null;

  const pad = markerPaddingForStep(step.id);
  const width = rect.width + pad.x * 2;
  const height = rect.height + pad.y * 2;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  return {
    width,
    height,
    path: buildHandCirclePath(width, height),
    style: {
      top: `${cy - height / 2}px`,
      left: `${cx - width / 2}px`,
      width: `${width}px`,
      height: `${height}px`
    }
  };
});

const underlineLayout = computed(() => {
  const step = currentStep.value;
  if (!step || step.kind !== 'underline') return null;

  const rect =
    step.id === 'create'
      ? measureCreateToolbarUnderlineRect()
      : step.id === 'projection'
        ? measureProjectionSummaryRect()
        : step.id === 'manage-request'
          ? measureRequestsHeadingRect()
          : step.id === 'reservation-clarify'
            ? measureReservationsClarifyRect()
            : targetRect.value;
  if (!rect) return null;

  const pad = markerPaddingForStep(step.id);
  const width = rect.width + pad.x * 2;
  const height = 12;
  const rowBottom = rect.top + rect.height;

  return {
    width,
    height,
    path: buildHandUnderlinePath(width, height),
    style: {
      top: `${rowBottom + 2}px`,
      left: `${rect.left - pad.x}px`,
      width: `${width}px`,
      height: `${height}px`
    }
  };
});

let confettiFn: ((opts: { position: { x: number; y: number }; count: number; velocity: number }) => void) | null =
  null;

const burstConfetti = async (yRatio = 0.45) => {
  if (!import.meta.client) return;
  if (!confettiFn) {
    const mod = await import('@hiseb/confetti');
    confettiFn = mod.default as typeof confettiFn;
  }
  if (!confettiFn) return;
  confettiFn({
    position: { x: window.innerWidth * 0.5, y: window.innerHeight * yRatio },
    count: 120,
    velocity: 220
  });
};

const clearRewardCloseTimer = () => {
  if (rewardCloseTimer) {
    clearTimeout(rewardCloseTimer);
    rewardCloseTimer = null;
  }
};

const dismissReward = () => {
  if (!showRewardReveal.value) return;
  clearRewardCloseTimer();
  showRewardClose.value = false;
  showRewardReveal.value = false;
  finishTraining();
};

const revealReward = async () => {
  showRewardReveal.value = true;
  showRewardClose.value = false;
  await burstConfetti(0.42);
  window.setTimeout(() => burstConfetti(0.5), 180);
  clearRewardCloseTimer();
  rewardCloseTimer = setTimeout(() => {
    showRewardClose.value = true;
  }, 3000);
};

const onAcknowledge = async () => {
  if (isLastStep.value) {
    if (!isRetakeMode.value && canClaimVacationAchievement()) {
      await revealReward();
      return;
    }
    finishTraining();
    return;
  }
  acknowledgeStep();
};

const scrollAsideToShowElement = (el: HTMLElement) => {
  const aside = document.querySelector(
    '.employee-aside--fit:not(.employee-aside--embedded)'
  ) as HTMLElement | null;
  if (!aside || !aside.contains(el)) return;

  const padding = 12;
  const asideRect = aside.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const elTop = aside.scrollTop + (elRect.top - asideRect.top);
  const elBottom = elTop + elRect.height;
  const viewTop = aside.scrollTop;
  const viewBottom = aside.scrollTop + aside.clientHeight;

  if (elTop < viewTop + padding) {
    aside.scrollTop = Math.max(0, elTop - padding);
  } else if (elBottom > viewBottom - padding) {
    aside.scrollTop = elBottom - aside.clientHeight + padding;
  }
};

const scrollAsideForStep = (step: { id?: string; target?: string | null }) => {
  if (!step.target) return;

  if (step.id === 'reservation-clarify') {
    const block = document.querySelector('[data-tour="vac-reservations-block"]') as HTMLElement | null;
    if (block) scrollAsideToShowElement(block);
    return;
  }

  if (step.id === 'requests') {
    scrollAsideToRequests();
    return;
  }

  const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
  if (el) scrollAsideToShowElement(el);
};

const runStepLayout = (step: typeof currentStep.value) => {
  syncActiveTarget();
  nextTick(() => {
    if (step) scrollAsideForStep(step);
    updateGeometry();
    requestAnimationFrame(() => {
      if (step) scrollAsideForStep(step);
      updateGeometry();
    });
  });
};

const scrollAsideToRequests = () => {
  const aside = document.querySelector(
    '.employee-aside--fit:not(.employee-aside--embedded)'
  ) as HTMLElement | null;
  const block = document.querySelector('[data-tour="vac-my-requests"]') as HTMLElement | null;
  if (!aside || !block) return;

  const asideRect = aside.getBoundingClientRect();
  const blockRect = block.getBoundingClientRect();
  const blockBottomInAside = aside.scrollTop + (blockRect.bottom - asideRect.top);
  const targetScroll = blockBottomInAside - aside.clientHeight + 16;
  aside.scrollTop = Math.max(0, targetScroll);
};

watch(currentStep, (step) => {
  runStepLayout(step);
}, { immediate: true });

onMounted(() => {
  runStepLayout(currentStep.value);
  window.addEventListener('resize', updateGeometry);
  window.addEventListener('scroll', updateGeometry, true);
});

onUnmounted(() => {
  clearRewardCloseTimer();
  clearActiveTarget();
  window.removeEventListener('resize', updateGeometry);
  window.removeEventListener('scroll', updateGeometry, true);
});

watch(isActive, (active) => {
  if (!active) {
    showRewardReveal.value = false;
    showRewardClose.value = false;
    clearRewardCloseTimer();
  }
});
</script>
