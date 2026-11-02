<template>
  <div class="og-plug" :class="{ 'is-on': plugged }">
    <div ref="trackRef" class="og-plug__track">
      <OgonekSprite class="og-plug__socket" :rows="OGONEK_OBJECTS.socket" :width="96" alt="Розетка" />

      <!-- Шнур тянется за вилкой -->
      <span class="og-plug__cord" :style="{ width: `${cordWidth}px` }" />

      <button
        ref="plugRef"
        type="button"
        class="og-plug__handle"
        :style="{ transform: `translate(${offset}px, -50%)` }"
        :aria-label="plugged ? 'Вынуть вилку' : 'Воткнуть вилку в розетку'"
        @pointerdown="onDown"
        @keydown.enter.prevent="toggle"
        @keydown.space.prevent="toggle"
      >
        <OgonekSprite :rows="OGONEK_DECOR.plug" :width="84" />
      </button>

      <span v-if="plugged" class="og-plug__spark" aria-hidden="true" />
    </div>

    <p class="og-plug__state" aria-live="polite">
      {{ plugged ? 'Вилка в розетке. Декор горит на всей платформе.' : 'Вилка вынута. Тяните её к розетке.' }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Вилка и розетка из окна 4. Декор включается не галочкой в настройках,
 * а движением руки: тянешь вилку, втыкаешь — зажигается всё (спека, раздел 4).
 *
 * Клавиатурой тоже работает: по Enter вилка просто меняет состояние, иначе
 * выключатель был бы недоступен без мыши.
 */
import { OGONEK_DECOR, OGONEK_OBJECTS } from '~/events/ogonek/sprites';

const props = defineProps<{ plugged: boolean }>();
const emit = defineEmits<{ change: [on: boolean] }>();

const trackRef = ref<HTMLElement | null>(null);
const plugRef = ref<HTMLElement | null>(null);

/** Насколько далеко вилка уехала от исходной позиции, px. */
const offset = ref(0);
/** Путь от края до розетки: считается по реальной ширине дорожки. */
const travel = ref(180);
const dragging = ref(false);
let startX = 0;
let startOffset = 0;

const cordWidth = computed(() => Math.max(0, offset.value) + 12);

function measure() {
  const track = trackRef.value;
  if (!track) return;
  travel.value = Math.max(90, track.clientWidth - 190);
  offset.value = props.plugged ? travel.value : 0;
}

onMounted(() => {
  measure();
  window.addEventListener('resize', measure);
});
onBeforeUnmount(() => window.removeEventListener('resize', measure));

watch(
  () => props.plugged,
  (on) => {
    if (!dragging.value) offset.value = on ? travel.value : 0;
  }
);

/** Клавиатурный вариант того же действия. */
function toggle() {
  const on = !props.plugged;
  offset.value = on ? travel.value : 0;
  emit('change', on);
}

function onDown(e: PointerEvent) {
  dragging.value = true;
  startX = e.clientX;
  startOffset = offset.value;
  plugRef.value?.setPointerCapture?.(e.pointerId);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
}

function onMove(e: PointerEvent) {
  if (!dragging.value) return;
  const next = startOffset + (e.clientX - startX);
  offset.value = Math.min(travel.value, Math.max(0, next));
}

function onUp() {
  dragging.value = false;
  window.removeEventListener('pointermove', onMove);
  // Втыкается на последней трети пути, вынимается — когда ушла дальше трети назад.
  const on = offset.value > travel.value * 0.66;
  offset.value = on ? travel.value : 0;
  if (on !== props.plugged) emit('change', on);
}
</script>

<style scoped>
.og-plug {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.og-plug__track {
  position: relative;
  height: 110px;
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(26, 20, 18, 0.45), rgba(26, 20, 18, 0.15));
  border: 1px dashed rgba(232, 215, 180, 0.28);
  overflow: hidden;
}

.og-plug__socket {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
}

.og-plug__cord {
  position: absolute;
  left: 0;
  top: 50%;
  height: 6px;
  margin-top: -3px;
  background: #1f4136;
  border-top: 2px solid #1a1412;
  border-bottom: 2px solid #1a1412;
}

.og-plug__handle {
  position: absolute;
  left: 8px;
  top: 50%;
  padding: 0;
  border: 0;
  background: none;
  cursor: grab;
  touch-action: none;
}

.og-plug__handle:active {
  cursor: grabbing;
}

.og-plug__spark {
  position: absolute;
  right: 56px;
  top: 50%;
  width: 22px;
  height: 22px;
  margin-top: -11px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 239, 227, 0.95), rgba(217, 154, 43, 0));
  animation: og-plug-spark 1.8s ease-in-out infinite;
}

@keyframes og-plug-spark {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50% { opacity: 0.9; transform: scale(1.15); }
}

.og-plug__state {
  margin: 0;
  color: #e8d7b4;
  font-size: 14px;
}

.og-plug.is-on .og-plug__track {
  border-color: rgba(217, 154, 43, 0.6);
  box-shadow: inset 0 0 28px rgba(217, 154, 43, 0.22);
}

@media (prefers-reduced-motion: reduce) {
  .og-plug__spark { animation: none; opacity: 0.7; }
}
</style>
