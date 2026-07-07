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

      <article
        v-show="!showRewardReveal"
        class="vac-training-overlay__card"
        role="dialog"
        aria-labelledby="vac-manager-training-title"
        :style="cardStyle"
      >
        <button type="button" class="vac-training-overlay__skip" @click="skipTraining">Пропустить</button>

        <p class="vac-training-overlay__progress">{{ progressLabel }}</p>
        <h3 id="vac-manager-training-title" class="vac-training-overlay__title">{{ currentStep.title }}</h3>

        <template v-if="currentStep.id === 'warnings'">
          <ul class="vac-training-warnings list-reset">
            <li v-for="item in warningItems" :key="item.id" class="vac-training-warnings__item">
              <span :class="['vac-training-warnings__badge', item.badgeClass]">{{ item.title }}</span>
              <span class="vac-training-warnings__desc">{{ item.text }}</span>
            </li>
          </ul>
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
            <button type="button" class="vac-training-overlay__nav-btn vac-training-overlay__nav-btn--next" @click="onNext">
              {{ isLastStep ? 'Завершить' : 'Продолжить' }}
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
            <p class="vac-training-overlay__hint muted">Нажмите подсвеченную кнопку на экране ↑</p>
          </div>
        </div>
      </article>

      <div
        v-if="showRewardReveal"
        class="vac-training-reward vac-training-reward--close-ready"
        role="dialog"
        aria-labelledby="vac-manager-training-reward-title"
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
            <h2 id="vac-manager-training-reward-title" class="vac-training-reward__title">
              {{ trainingAchievement.title }}
            </h2>
            <p class="vac-training-reward__subtitle">{{ trainingAchievement.subtitle }}</p>
          </div>
          <button type="button" class="vac-training-reward__close" @click="dismissReward">Закрыть</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {
  MANAGER_VACATION_TRAINING_WARNING_ITEMS,
  VACATION_TRAINING_ACHIEVEMENT
} from '~/data/vacationTrainingQuest';
import { isEmployeeVacationTrainingCompleted } from '~/composables/useVacationTraining';
import { isDigitalGroupLeadName } from '~/utils/vacationApproval';

const { user } = useAuth();
const { managerProfileName } = useEmployees();
const { isActive, currentStep, stepIndex, totalSteps, progressLabel, goPrevStep, completeCurrentStep, skipTraining, finishTraining } =
  useManagerVacationTraining();

const warningItems = computed(() => {
  const profileName = managerProfileName(user.value);
  const showNextStage = isDigitalGroupLeadName(profileName);
  return MANAGER_VACATION_TRAINING_WARNING_ITEMS.filter(
    (item) => !('groupLeadsOnly' in item && item.groupLeadsOnly) || showNextStage
  );
});
const trainingAchievement = VACATION_TRAINING_ACHIEVEMENT;
const cardStyle = ref<Record<string, string>>({
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  maxWidth: 'min(420px, 92vw)'
});
const showRewardReveal = ref(false);
const isLastStep = computed(() => stepIndex.value >= totalSteps.value - 1);
const showAcknowledge = computed(() => currentStep.value?.action === 'acknowledge');

const shouldSpotlightTarget = (step: { target?: string | null; action?: string }) =>
  Boolean(step.target);

const TARGET_ACTIVE_CLASS = 'vac-training-target--active';
const SPOTLIGHT_PAD = 6;
const CARD_WIDTH = 340;
const VIEWPORT_MARGIN = 16;
const FOOTER_RESERVE = 88;
const targetRect = ref<DOMRect | null>(null);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const clearActiveTarget = () => {
  document.querySelectorAll(`[data-tour].${TARGET_ACTIVE_CLASS}`).forEach((el) => {
    el.classList.remove(TARGET_ACTIVE_CLASS);
  });
};

const syncActiveTarget = () => {
  clearActiveTarget();
  const step = currentStep.value;
  if (!step?.target) return;
  document.querySelector(`[data-tour="${step.target}"]`)?.classList.add(TARGET_ACTIVE_CLASS);
};

const spotlightLayout = computed(() => {
  const step = currentStep.value;
  if (!step || !shouldSpotlightTarget(step) || !targetRect.value) return null;
  return {
    style: {
      top: `${targetRect.value.top - SPOTLIGHT_PAD}px`,
      left: `${targetRect.value.left - SPOTLIGHT_PAD}px`,
      width: `${targetRect.value.width + SPOTLIGHT_PAD * 2}px`,
      height: `${targetRect.value.height + SPOTLIGHT_PAD * 2}px`,
      borderRadius: '10px'
    }
  };
});

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
  if (!el) return;
  const rect = el.getBoundingClientRect();
  targetRect.value = rect;

  const top = clamp(rect.bottom + 14, VIEWPORT_MARGIN, window.innerHeight - 240 - FOOTER_RESERVE);
  const left = clamp(rect.left, VIEWPORT_MARGIN, window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN);
  cardStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${CARD_WIDTH}px`,
    maxWidth: `min(${CARD_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`,
    transform: 'none'
  };
};

const shouldRevealAchievement = () => {
  const id = user.value?.id;
  if (!id) return false;
  return isEmployeeVacationTrainingCompleted(id);
};

const dismissReward = () => {
  showRewardReveal.value = false;
  finishTraining();
};

const onNext = () => {
  if (currentStep.value?.action !== 'acknowledge') return;
  if (!isLastStep.value) {
    completeCurrentStep();
    return;
  }
  if (shouldRevealAchievement()) {
    showRewardReveal.value = true;
    return;
  }
  finishTraining();
};

watch(isActive, (active) => {
  if (!active) {
    showRewardReveal.value = false;
    clearActiveTarget();
  }
});

watch(
  currentStep,
  () => {
    syncActiveTarget();
    nextTick(() => {
      updateGeometry();
      requestAnimationFrame(updateGeometry);
    });
  },
  { immediate: true }
);

onMounted(() => {
  syncActiveTarget();
  updateGeometry();
  window.addEventListener('resize', updateGeometry);
  window.addEventListener('scroll', updateGeometry, true);
});

onUnmounted(() => {
  clearActiveTarget();
  window.removeEventListener('resize', updateGeometry);
  window.removeEventListener('scroll', updateGeometry, true);
});
</script>
