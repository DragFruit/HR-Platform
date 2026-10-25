<template>
  <!-- Праздничная гирлянда-флажки: чистый SVG, без картинок -->
  <svg
    class="wish-garland"
    viewBox="0 0 320 44"
    preserveAspectRatio="none"
    fill="none"
    aria-hidden="true"
  >
    <path d="M0 6 Q160 30 320 6" stroke="#202020" stroke-width="1.6" />
    <g stroke="#202020" stroke-width="1.4" stroke-linejoin="round">
      <path
        v-for="(flag, i) in flags"
        :key="i"
        :d="flag.d"
        :fill="flag.fill"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
const COLORS = ['#ddf365', '#fd81ff', '#f3b33e', '#7451f4', '#ee815a', '#9fd6c9', '#ddf365', '#fd81ff', '#f3b33e'];

/** Точки на дуге Q(0,6)-(160,30)-(320,6), под каждой — треугольный флажок. */
const flags = COLORS.map((fill, i) => {
  const t = (i + 0.5) / COLORS.length;
  const x = 320 * t;
  const y = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 30 + t * t * 6;
  const w = 11;
  return { fill, d: `M${(x - w).toFixed(1)} ${y.toFixed(1)} L${(x + w).toFixed(1)} ${y.toFixed(1)} L${x.toFixed(1)} ${(y + 18).toFixed(1)} Z` };
});
</script>

<style scoped>
.wish-garland {
  display: block;
  width: 100%;
  height: 40px;
}
</style>
