<template>
  <span
    class="ogenv"
    :class="{ 'is-flap-up': flapUp, 'is-sealed': sealed, 'is-breaking': breaking }"
    :style="{ width: `${width}px` }"
  >
    <OgonekSprite class="ogenv__back" :rows="ENVELOPE_BACK" width-css="100%" />
    <span v-if="paper" class="ogenv__sheet" :class="{ 'is-out': sheetOut }" :style="{ backgroundImage: `url(${paper})` }" />
    <OgonekSprite class="ogenv__front" :rows="ENVELOPE_FRONT" width-css="100%" />
    <OgonekSprite class="ogenv__flap" :rows="ENVELOPE_FLAP" width-css="100%" />
    <OgonekSprite v-if="sealed || breaking" class="ogenv__seal" :rows="ENVELOPE_SEAL" width-css="21.875%" />
  </span>
</template>

<script setup lang="ts">
/**
 * Конверт по слоям: стенка, лист, карман, клапан, сургуч. Анимацией управляет
 * тот, кто его показывает: здесь только состояния.
 * Ширина кратна сетке 64 (128, 192, 256, 320), чтобы пиксели были ровными.
 */
import { ENVELOPE_BACK, ENVELOPE_FLAP, ENVELOPE_FRONT, ENVELOPE_SEAL } from '~/events/ogonek/mailArt';

withDefaults(
  defineProps<{
    width?: number;
    sealed?: boolean;
    breaking?: boolean;
    flapUp?: boolean;
    sheetOut?: boolean;
    paper?: string;
  }>(),
  { width: 192, sealed: true, breaking: false, flapUp: false, sheetOut: false, paper: '' }
);
</script>

<style scoped>
.ogenv {
  position: relative;
  display: block;
  aspect-ratio: 64 / 40;
  perspective: 700px;
}

.ogenv > * { position: absolute; left: 0; top: 0; }
.ogenv__back { z-index: 1; }
.ogenv__front { z-index: 3; }

.ogenv__sheet {
  z-index: 2;
  left: 8%;
  right: 8%;
  width: auto;
  top: 6%;
  height: 88%;
  background-size: 100% 100%;
  image-rendering: pixelated;
  transition: transform 0.55s cubic-bezier(0.25, 0.9, 0.35, 1);
}

.ogenv__sheet.is-out { transform: translateY(-78%); }

.ogenv__flap {
  z-index: 4;
  transform-origin: 50% 0;
  transition: transform 0.45s ease-in-out, z-index 0s linear 0.22s;
}

/* Поднятый клапан уходит за лист: иначе лист выезжал бы сквозь него */
.ogenv.is-flap-up .ogenv__flap {
  z-index: 0;
  transform: rotateX(180deg);
}

.ogenv__seal {
  z-index: 5;
  left: 39.0625%;
  top: 43%;
}

.ogenv.is-breaking .ogenv__seal {
  animation: ogenv-break 0.28s ease-in forwards;
}

@keyframes ogenv-break {
  40% { transform: scale(1.18) rotate(-6deg); }
  100% { transform: scale(0.5) translateY(30px) rotate(24deg); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .ogenv__sheet, .ogenv__flap { transition: none; }
  .ogenv.is-breaking .ogenv__seal { animation: none; opacity: 0; }
}
</style>
