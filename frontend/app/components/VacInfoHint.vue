<template>
  <span
    ref="anchorRef"
    class="vac-info-hint"
    @mouseenter="onEnter"
    @mouseleave="scheduleHide"
  >
    <button
      type="button"
      class="vac-info-hint__btn"
      :aria-label="`Что входит в «${label}»`"
      :aria-expanded="open"
      :aria-describedby="open ? tooltipId : undefined"
      @click.stop.prevent="toggle"
      @focus="show"
      @blur="onBlur"
      @keydown.esc="hide"
    >
      <span aria-hidden="true">?</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        :id="tooltipId"
        ref="popoverRef"
        class="vac-info-hint__pop"
        :class="`vac-info-hint__pop--${resolvedPlacement}`"
        role="tooltip"
        :style="{ top: `${position.top}px`, left: `${position.left}px` }"
        @mouseenter="cancelHide"
        @mouseleave="scheduleHide"
      >
        <p class="vac-info-hint__title">{{ label }}</p>
        <p class="vac-info-hint__text">{{ text }}</p>
        <p v-if="reservationsNote" class="vac-info-hint__text vac-info-hint__note">
          Брони
          <span class="emp-reservation-add-label vac-info-hint__sample" aria-hidden="true">+бронь</span>
          не учитываются.
        </p>
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
/**
 * Кружок «?» рядом с подписью цифры: подсказка по наведению, фокусу с клавиатуры и тапу.
 * reservationsNote — строка «Брони [+бронь] не учитываются» с той же плашкой, что в календаре.
 */
defineProps<{
  label: string;
  text: string;
  reservationsNote?: boolean;
}>();

const tooltipId = `vac-info-hint-${useId()}`;
const anchorRef = ref<HTMLElement | null>(null);
const popoverRef = ref<HTMLElement | null>(null);
const open = ref(false);
/** Открыто тапом/кликом: не закрывать по уходу мыши, только по второму тапу или клику мимо. */
const pinned = ref(false);

const { position, resolvedPlacement, updatePosition } = useFloatingPosition(anchorRef, popoverRef, open, {
  placement: 'bottom-start',
  offset: 8
});

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

const hide = () => {
  clearHideTimer();
  pinned.value = false;
  open.value = false;
};

const onEnter = () => show();

const scheduleHide = () => {
  if (pinned.value) return;
  clearHideTimer();
  hideTimer = setTimeout(() => {
    open.value = false;
  }, 120);
};

const cancelHide = () => clearHideTimer();

const toggle = () => {
  if (open.value && pinned.value) {
    hide();
    return;
  }
  pinned.value = true;
  show();
};

const onBlur = (event: FocusEvent) => {
  const next = event.relatedTarget as Node | null;
  if (next && popoverRef.value?.contains(next)) return;
  if (pinned.value) return;
  scheduleHide();
};

const onDocumentPointer = (event: Event) => {
  if (!open.value) return;
  const target = event.target as Node;
  if (anchorRef.value?.contains(target) || popoverRef.value?.contains(target)) return;
  hide();
};

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointer);
});

onUnmounted(() => {
  clearHideTimer();
  document.removeEventListener('pointerdown', onDocumentPointer);
});
</script>
