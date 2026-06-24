<template>
  <span
    ref="anchorRef"
    class="vac-advance-badge-wrap"
    @mouseenter="show"
    @mouseleave="scheduleHide"
    @focusin="show"
    @focusout="onFocusOut"
  >
    <span class="vac-advance-badge" tabindex="0">
      <span class="vac-advance-badge__dot" aria-hidden="true" />
      Аванс {{ assessment.deficit }} дн.
    </span>

    <Teleport to="body">
      <div
        v-if="open"
        ref="popoverRef"
        class="vac-advance-popover vac-advance-popover--teleported"
        :class="`vac-advance-popover--${resolvedPlacement}`"
        role="tooltip"
        :style="{ top: `${position.top}px`, left: `${position.left}px` }"
        @mouseenter="cancelHide"
        @mouseleave="scheduleHide"
      >
        <p class="vac-advance-popover__title">Баланс к началу отпуска</p>
        <dl class="vac-advance-popover__meta">
          <div>
            <dt>Нужно</dt>
            <dd>{{ assessment.neededDays }} дн.</dd>
          </div>
          <div>
            <dt>Будет доступно к {{ assessment.startLabel }}</dt>
            <dd>{{ assessment.availableAtStart }} дн.</dd>
          </div>
          <div>
            <dt>Аванс</dt>
            <dd class="vac-advance-popover__deficit">{{ assessment.deficit }} дн.</dd>
          </div>
        </dl>
        <p class="vac-advance-popover__hint">Праздники в период не входят в счёт отпуска.</p>
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import type { VacationBalanceAssessment } from '~/utils/vacationBalance';

defineProps<{
  assessment: VacationBalanceAssessment;
}>();

const anchorRef = ref<HTMLElement | null>(null);
const popoverRef = ref<HTMLElement | null>(null);
const open = ref(false);

const { position, resolvedPlacement, updatePosition } = useFloatingPosition(
  anchorRef,
  popoverRef,
  open,
  { placement: 'bottom-start', offset: 10 }
);

let hideTimer: ReturnType<typeof setTimeout> | null = null;

const clearHideTimer = () => {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
};

const show = () => {
  clearHideTimer();
  open.value = true;
  updatePosition();
};

const scheduleHide = () => {
  clearHideTimer();
  hideTimer = setTimeout(() => {
    open.value = false;
  }, 120);
};

const cancelHide = () => {
  clearHideTimer();
};

const onFocusOut = (event: FocusEvent) => {
  const next = event.relatedTarget as Node | null;
  if (next && (anchorRef.value?.contains(next) || popoverRef.value?.contains(next))) return;
  scheduleHide();
};

onUnmounted(() => {
  clearHideTimer();
});
</script>
