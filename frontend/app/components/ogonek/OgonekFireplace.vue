<template>
  <div class="og-fire" :style="{ width: `${width}px` }">
    <OgonekSprite :rows="OGONEK_DECOR.fireplace" :width="width" alt="" />
    <span class="og-fire__glow" />
    <span
      v-for="f in FLAMES"
      :key="f.id"
      class="og-fire__flame"
      :style="{
        left: `${f.left}%`,
        width: `${width * f.scale}px`,
        animationDuration: `${f.duration}s`,
        animationDelay: `${f.delay}s`,
        backgroundImage: flameUrl ? `url(${flameUrl})` : 'none'
      }"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Камин в углу главной. Огонь живой: три язычка разного размера дышат
 * вразнобой, под ними тёплое пятно света. Никакого мигания — только
 * медленное колебание, иначе в углу экрана это быстро начинает раздражать.
 */
import { OGONEK_DECOR } from '~/events/ogonek/sprites';
import { ogonekSpriteUrl } from '~/utils/ogonekRender';

withDefaults(defineProps<{ width?: number }>(), { width: 150 });

const FLAMES = [
  { id: 'a', left: 26, scale: 0.2, duration: 2.6, delay: 0 },
  { id: 'b', left: 44, scale: 0.28, duration: 3.4, delay: 0.5 },
  { id: 'c', left: 62, scale: 0.18, duration: 2.1, delay: 1.1 }
];

const mounted = ref(false);
onMounted(() => { mounted.value = true; });
const flameUrl = computed(() => (mounted.value ? ogonekSpriteUrl(OGONEK_DECOR.flame) : ''));
</script>

<style scoped>
.og-fire {
  position: relative;
  display: block;
}

.og-fire__flame {
  position: absolute;
  bottom: 10%;
  /* Язычок вытянутый: 16×24, квадратом он выглядел бы раздавленным. */
  aspect-ratio: 16 / 24;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  image-rendering: pixelated;
  transform-origin: 50% 100%;
  animation: og-flame ease-in-out infinite;
}

@keyframes og-flame {
  0%, 100% { transform: scaleY(1) scaleX(1) translateY(0); opacity: 0.95; }
  35% { transform: scaleY(1.22) scaleX(0.92) translateY(-6%); opacity: 1; }
  65% { transform: scaleY(0.9) scaleX(1.06) translateY(2%); opacity: 0.85; }
}

.og-fire__glow {
  position: absolute;
  left: 50%;
  bottom: 6%;
  width: 90%;
  height: 46%;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at 50% 100%, rgba(217, 154, 43, 0.55), rgba(217, 154, 43, 0));
  animation: og-fire-glow 4.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes og-fire-glow {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.9; }
}

@media (prefers-reduced-motion: reduce) {
  .og-fire__flame,
  .og-fire__glow { animation: none; }
}
</style>
