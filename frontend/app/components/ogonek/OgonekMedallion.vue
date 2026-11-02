<template>
  <button
    type="button"
    class="og-med"
    :class="[
      `og-med--${state}`,
      { 'is-open': day.opened, 'is-locked': !day.opened && !day.openable }
    ]"
    :aria-label="ariaLabel"
    :title="hint"
    :style="{ '--og-med-size': `${size}px` }"
    @click="$emit('open', day.id)"
  >
    <span class="og-med__card">
      <!-- Лицевая сторона: закрытое окно, узел вместо объекта -->
      <span class="og-med__face og-med__face--front">
        <OgonekSprite :rows="OGONEK_DECOR.medallionClosed" width-css="100%" />
        <!-- Номер стоит по центру узла: на закрытой стороне это единственное,
             что должно читаться. -->
        <span class="og-med__num">{{ day.id }}</span>
      </span>

      <!-- Оборот: открытое окно, внутри объект дня -->
      <span class="og-med__face og-med__face--back">
        <OgonekSprite :rows="frameRows" width-css="100%" />
        <OgonekSprite class="og-med__object" :rows="objectRows" width-css="33.34%" />
      </span>
    </span>

    <span class="og-med__caption">
      <span class="og-med__date">{{ day.id }} · {{ dateLabel }}</span>
      <span v-if="day.today" class="og-med__today">сегодня</span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { OGONEK_DECOR, OGONEK_OBJECTS } from '~/events/ogonek/sprites';
import { formatOgonekDate } from '~/events/ogonek/timeline';
import type { OgonekDayView } from '~/events/ogonek/types';

const props = withDefaults(defineProps<{ day: OgonekDayView; size?: number }>(), { size: 120 });
defineEmits<{ open: [id: number] }>();

const state = computed(() => {
  if (props.day.opened) return 'open';
  if (props.day.today) return 'today';
  if (props.day.openable) return 'ready';
  return 'closed';
});

/** Сегодняшнее окно получает свою рамку — с бликами по углам. */
const frameRows = computed(() =>
  props.day.today ? OGONEK_DECOR.medallionToday : OGONEK_DECOR.medallionOpen
);

const objectRows = computed(() => OGONEK_OBJECTS[props.day.object] ?? OGONEK_OBJECTS.ogonek);

const dateLabel = computed(() => formatOgonekDate(props.day.dateIso));

const hint = computed(() => {
  if (props.day.opened) return props.day.title;
  if (props.day.blockedBy) return `Сначала окно ${props.day.blockedBy}`;
  if (!props.day.scheduleOpen) return `Откроется ${dateLabel.value} в 10:00`;
  return 'Можно открыть';
});

const ariaLabel = computed(
  () => `Окно ${props.day.id}, ${dateLabel.value}. ${props.day.opened ? props.day.title : hint.value}`
);
</script>

<style scoped>
.og-med {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  /*
    Ширина задаётся явно. Без этого `justify-items: center` сжимал кнопку
    по ширине подписи, и `width: 100%` у карточки упирался в неё же —
    медальон схлопывался до размера даты.
  */
  width: min(var(--og-med-size), 100%);
  padding: 0;
  background: none;
  border: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.og-med__card {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  transform-style: preserve-3d;
  transition: transform 0.75s cubic-bezier(0.3, 1.2, 0.4, 1);
}

.og-med.is-open .og-med__card {
  transform: rotateY(180deg);
}

.og-med__face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  display: block;
}

.og-med__face--back {
  transform: rotateY(180deg);
}

.og-med__object {
  position: absolute;
  /* Окно в рамке — ровно центральные 32×96 сетки. */
  left: 33.34%;
  top: 33.34%;
}

.og-med__num {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-family: 'Unbounded', system-ui, sans-serif;
  font-weight: 700;
  font-size: clamp(14px, calc(var(--og-med-size) * 0.17), 26px);
  color: #e8d7b4;
  text-shadow: 0 2px 0 #1a1412;
}

.og-med__caption {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
}

.og-med__date {
  font-size: 12px;
  color: #e8d7b4;
  opacity: 0.75;
}

.og-med__today {
  font-size: 11px;
  color: #d99a2b;
  font-weight: 600;
}

/* Наведение: медальон чуть всплывает и теплеет. Закрытые — не реагируют. */
.og-med:not(.is-locked):hover .og-med__card,
.og-med:focus-visible .og-med__card {
  filter: drop-shadow(0 6px 14px rgba(217, 154, 43, 0.35));
}

.og-med:not(.is-locked):hover {
  transform: translateY(-3px);
}

.og-med {
  transition: transform 0.25s ease;
}

.og-med.is-locked {
  cursor: not-allowed;
  opacity: 0.62;
}

/* Сегодняшнее окно тихо дышит — чтобы глаз нашёл его без подписи. */
.og-med--today .og-med__card {
  animation: og-med-breathe 3.4s ease-in-out infinite;
}

@keyframes og-med-breathe {
  0%, 100% { filter: drop-shadow(0 0 0 rgba(217, 154, 43, 0)); }
  50% { filter: drop-shadow(0 0 12px rgba(217, 154, 43, 0.55)); }
}

/* Окно, до которого дошла очередь, подмигивает охрой. */
.og-med--ready .og-med__card {
  animation: og-med-ready 2.6s ease-in-out infinite;
}

@keyframes og-med-ready {
  0%, 100% { transform: rotate(0deg); }
  48% { transform: rotate(-1.2deg); }
  74% { transform: rotate(1.2deg); }
}

@media (prefers-reduced-motion: reduce) {
  .og-med__card,
  .og-med {
    transition: none;
    animation: none !important;
  }
  .og-med.is-open .og-med__card {
    transform: rotateY(180deg);
  }
}
</style>
