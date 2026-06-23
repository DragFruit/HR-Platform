<template>
  <span
    ref="anchorRef"
    class="vac-overlap-badge-wrap"
    @mouseenter="show"
    @mouseleave="scheduleHide"
    @focusin="show"
    @focusout="onFocusOut"
  >
    <span class="vac-overlap-badge" tabindex="0">
      <span class="vac-overlap-badge__dot" aria-hidden="true" />
      Есть пересечение
    </span>

    <Teleport to="body">
      <div
        v-if="open"
        ref="popoverRef"
        class="vac-overlap-popover vac-overlap-popover--teleported"
        :class="`vac-overlap-popover--${resolvedPlacement}`"
        role="tooltip"
        :style="{ top: `${position.top}px`, left: `${position.left}px` }"
        @mouseenter="cancelHide"
        @mouseleave="scheduleHide"
      >
        <p class="vac-overlap-popover__title">Пересечения отпусков</p>
        <div
          v-for="(item, index) in items"
          :key="`${item.employee}-${item.vacationStart}-${index}`"
          class="vac-overlap-popover__item"
        >
          <strong>{{ item.employee }}</strong>
          <dl class="vac-overlap-popover__meta">
            <div>
              <dt>Отпуск</dt>
              <dd>{{ formatRange(item.vacationStart, item.vacationEnd) }}</dd>
            </div>
            <div>
              <dt>Пересечение</dt>
              <dd>{{ formatRange(item.overlapStart, item.overlapEnd) }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import type { VacationOverlapDetail } from '~/utils/vacationCalendar';

defineProps<{
  items: VacationOverlapDetail[];
  formatRange: (start: string, end: string) => string;
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
