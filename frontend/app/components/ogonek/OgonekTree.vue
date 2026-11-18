<template>
  <div ref="rootRef" class="og-tree">
    <div class="og-tree__stage" :style="{ width: `${stageW}px`, height: `${stageH}px` }">
      <span class="og-tree__img" :style="{ backgroundImage: art ? `url(${art.url})` : 'none' }" aria-hidden="true" />

      <span
        v-for="(b, i) in bulbs"
        :key="i"
        class="og-tree__bulb"
        :style="{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, '--c': b.color, '--g': `${scale * 16}px`, animationDelay: `${b.delay}s` }"
        aria-hidden="true"
      />

      <button
        v-for="(toy, i) in placed"
        :key="toy.id"
        :ref="(el) => setToyEl(toy.id, el)"
        type="button"
        class="og-tree__toy"
        :class="{ 'is-mine': toy.id === myToyId, 'is-open': openId === toy.id, 'is-found': foundId === toy.id }"
        :style="{
          left: `${toy.x * 100}%`,
          top: `${toy.y * 100}%`,
          width: `${toyPx}px`,
          zIndex: Math.round(toy.y * 1000),
          '--og-toy-delay': `${(i % 9) * 0.41}s`
        }"
        :aria-label="`Игрушка: ${toy.name}. ${toy.wish}`"
        @click="openId = openId === toy.id ? '' : toy.id"
      >
        <span class="og-tree__string" aria-hidden="true" />
        <OgonekSprite :rows="toy.pixels" width-css="100%" by-value />
      </button>

      <div
        v-if="openToy"
        class="og-tree__card"
        :style="cardStyle"
        role="dialog"
        :aria-label="`Пожелание: ${openToy.name}`"
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
 * Большая ёлка желаний: огромная и пышная, её прокручивают вниз, а не видят
 * целиком на первом экране. Каждая игрушка нарисована кем-то из нас и висит
 * на нитке; клик — пожелание и подпись.
 *
 * Ёлка — пиксельная сетка (treeArt.ts) с целым увеличением, чтобы пиксели
 * были ровными. Огоньки гирлянды светятся отдельными элементами поверх.
 */
import { ogonekTreeImage, type OgonekTreeBulb } from '~/events/ogonek/treeArt';
import { ogonekTreeClamp, OGONEK_TREE_H, OGONEK_TREE_W } from '~/events/ogonek/treePlacement';
import type { OgonekToy } from '~/events/ogonek/types';

const props = withDefaults(defineProps<{ toys: OgonekToy[]; myToyId?: string | null }>(), { myToyId: null });

const rootRef = ref<HTMLElement | null>(null);
const scale = ref(8);
const art = ref<{ url: string; bulbs: OgonekTreeBulb[] } | null>(null);
/** Игрушки рисуют люди сеткой 16×16 — у них свой масштаб, не пиксель ёлки. */
const openId = ref('');
const foundId = ref('');

const stageW = computed(() => OGONEK_TREE_W * scale.value);
const stageH = computed(() => OGONEK_TREE_H * scale.value);
const toyPx = computed(() => (stageW.value >= 1000 ? 64 : 48));
const bulbs = computed(() => art.value?.bulbs ?? []);

/** Игрушки со старыми координатами мягко сдвигаем на хвою. */
const placed = computed(() => props.toys.map((t) => ({ ...t, ...ogonekTreeClamp(t) })));
const openToy = computed(() => placed.value.find((t) => t.id === openId.value) ?? null);

/** Карточка под игрушкой, но не вылезает за края ёлки. */
const cardStyle = computed(() => {
  const t = openToy.value;
  if (!t) return {};
  const x = Math.min(0.78, Math.max(0.22, t.x));
  return { left: `${x * 100}%`, top: `calc(${t.y * 100}% + ${toyPx.value / 2 + 10}px)` };
});

const toyEls = new Map<string, HTMLElement>();
function setToyEl(id: string, el: unknown) {
  if (el instanceof HTMLElement) toyEls.set(id, el);
  else toyEls.delete(id);
}

/** «Найти мою»: прокрутить к игрушке, подсветить и открыть пожелание. */
function reveal(id: string) {
  const el = toyEls.get(id);
  if (!el) return;
  let smooth = true;
  try {
    smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    smooth = true;
  }
  el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  foundId.value = id;
  openId.value = id;
  setTimeout(() => { if (foundId.value === id) foundId.value = ''; }, 2600);
}

function measure() {
  const w = rootRef.value?.clientWidth ?? 0;
  // Пиксель ёлки 2–3 экранных: мелкий, детали читаются, ёлка влезает по ширине
  scale.value = Math.max(2, Math.min(3, Math.floor(w / OGONEK_TREE_W)));
}

let ro: ResizeObserver | null = null;
onMounted(() => {
  art.value = ogonekTreeImage();
  measure();
  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    ro = new ResizeObserver(measure);
    ro.observe(rootRef.value);
  }
});
onBeforeUnmount(() => ro?.disconnect());

defineExpose({ reveal });
</script>

<style scoped>
.og-tree { display: flex; justify-content: center; min-width: 0; overflow: hidden; }

.og-tree__stage { position: relative; flex: none; isolation: isolate; }

.og-tree__img {
  position: absolute;
  inset: 0;
  background-size: 100% 100%;
  image-rendering: pixelated;
}

.og-tree__bulb {
  position: absolute;
  width: var(--g);
  height: var(--g);
  margin: calc(var(--g) / -2) 0 0 calc(var(--g) / -2);
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--c) 70%, transparent) 0, transparent 62%);
  mix-blend-mode: screen;
  pointer-events: none;
  animation: og-tree-candle 2.6s steps(1, end) infinite;
}

/* Пламя свечи дрожит: неровные шаги яркости и размера */
@keyframes og-tree-candle {
  0% { opacity: 0.55; transform: scale(1); }
  17% { opacity: 0.72; transform: scale(1.06); }
  31% { opacity: 0.5; transform: scale(0.96); }
  46% { opacity: 0.68; transform: scale(1.03); }
  63% { opacity: 0.6; transform: scale(0.98); }
  78% { opacity: 0.76; transform: scale(1.08); }
  100% { opacity: 0.55; transform: scale(1); }
}

.og-tree__toy {
  position: absolute;
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  transform: translate(-50%, -50%);
  transform-origin: 50% -60%;
  animation: og-toy-sway 4.6s ease-in-out infinite;
  animation-delay: var(--og-toy-delay);
  filter: drop-shadow(2px 3px 0 rgba(30, 12, 14, 0.45));
}

@keyframes og-toy-sway {
  0%, 100% { transform: translate(-50%, -50%) rotate(-3deg); }
  50% { transform: translate(-50%, -50%) rotate(3deg); }
}

.og-tree__toy:hover,
.og-tree__toy:focus-visible,
.og-tree__toy.is-open {
  filter: drop-shadow(0 0 8px rgba(255, 250, 240, 0.85));
  z-index: 2000 !important;
}

.og-tree__toy.is-mine { filter: drop-shadow(0 0 7px rgba(255, 211, 92, 0.95)); }

/* Нашли свою: игрушка подпрыгивает и светится */
.og-tree__toy.is-found { animation: og-toy-found 0.9s ease-in-out 3; }

@keyframes og-toy-found {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -62%) scale(1.25); }
}

.og-tree__string {
  position: absolute;
  left: 50%;
  bottom: 100%;
  width: 2px;
  height: 40%;
  margin-left: -1px;
  background: #f4e6c8;
  opacity: 0.85;
}

.og-tree__card {
  position: absolute;
  z-index: 3000;
  transform: translateX(-50%);
  width: min(280px, 70vw);
  background: #f3efe9;
  box-shadow: 5px 6px 0 #1c0307;
  padding: 12px 14px;
  color: #2a1216;
}

.og-tree__wish { margin: 0; font-size: 16px; line-height: 1.45; }
.og-tree__who { margin: 8px 0 0; font-size: 13px; color: #7a5a5e; }

@media (prefers-reduced-motion: reduce) {
  .og-tree__toy, .og-tree__toy.is-found { animation: none; transform: translate(-50%, -50%); }
  .og-tree__bulb { animation: none; opacity: 0.5; }
}
</style>
