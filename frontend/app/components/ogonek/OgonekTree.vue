<template>
  <div class="og-tree">
    <div class="og-tree__stage" :style="{ width: `${width}px` }">
      <OgonekSprite :rows="OGONEK_DECOR.tree" :width="width" alt="Ёлка желаний" />

      <button
        v-for="(toy, i) in toys"
        :key="toy.id"
        type="button"
        class="og-tree__toy"
        :class="{ 'is-mine': toy.id === myToyId, 'is-open': openId === toy.id }"
        :style="{
          left: `${toy.x * 100}%`,
          top: `${toy.y * 100}%`,
          '--og-toy-delay': `${(i % 7) * 0.37}s`
        }"
        :aria-label="`Игрушка: ${toy.name}`"
        @click="openId = openId === toy.id ? '' : toy.id"
      >
        <span class="og-tree__string" aria-hidden="true" />
        <OgonekSprite :rows="toy.pixels" :width="toyWidth" by-value />
      </button>

      <div
        v-if="openToy"
        class="og-tree__card"
        :style="{ left: `${openToy.x * 100}%`, top: `${openToy.y * 100}%` }"
        role="dialog"
      >
        <p class="og-tree__wish">«{{ openToy.wish }}»</p>
        <p class="og-tree__who">
          {{ openToy.name }}<template v-if="openToy.department"> · {{ openToy.department }}</template>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Ёлка желаний: общая, одна на всех. Игрушки уникальные и подписанные —
 * на семидесяти людях это не каша, а портрет компании (спека, раздел 4b).
 *
 * Игрушка висит на верёвочке и покачивается. Покачивание у всех разное:
 * одинаковая фаза выглядит как механизм, а не как ёлка.
 */
import { OGONEK_DECOR } from '~/events/ogonek/sprites';
import type { OgonekToy } from '~/events/ogonek/types';

const props = withDefaults(
  defineProps<{
    toys: OgonekToy[];
    myToyId?: string | null;
    width?: number;
    toyWidth?: number;
  }>(),
  { myToyId: null, width: 620, toyWidth: 34 }
);

const openId = ref('');
const openToy = computed(() => props.toys.find((t) => t.id === openId.value) ?? null);
</script>

<style scoped>
.og-tree {
  display: flex;
  justify-content: center;
}

.og-tree__stage {
  position: relative;
  max-width: 100%;
}

.og-tree__toy {
  position: absolute;
  transform: translate(-50%, -50%);
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  transform-origin: 50% -140%;
  animation: og-toy-sway 4.6s ease-in-out infinite;
  animation-delay: var(--og-toy-delay);
}

@keyframes og-toy-sway {
  0%, 100% { transform: translate(-50%, -50%) rotate(-2.4deg); }
  50% { transform: translate(-50%, -50%) rotate(2.4deg); }
}

.og-tree__toy:hover,
.og-tree__toy:focus-visible,
.og-tree__toy.is-open {
  filter: drop-shadow(0 0 8px rgba(245, 239, 227, 0.75));
  z-index: 3;
}

.og-tree__toy.is-mine {
  filter: drop-shadow(0 0 6px rgba(217, 154, 43, 0.85));
}

.og-tree__string {
  position: absolute;
  left: 50%;
  bottom: 100%;
  width: 2px;
  height: 14px;
  margin-left: -1px;
  background: #e8d7b4;
  opacity: 0.8;
}

.og-tree__card {
  position: absolute;
  transform: translate(-50%, 14px);
  min-width: 190px;
  max-width: 260px;
  background: #f3efe9;
  border: 0;
  box-shadow: 4px 4px 0 #1c0307;
  padding: 10px 12px;
  color: #2a1216;
  z-index: 5;
}

.og-tree__wish { margin: 0; font-size: 14px; line-height: 1.45; }
.og-tree__who { margin: 6px 0 0; font-size: 12px; color: #7a5a5e; }

@media (prefers-reduced-motion: reduce) {
  .og-tree__toy {
    animation: none;
    transform: translate(-50%, -50%);
  }
}
</style>
