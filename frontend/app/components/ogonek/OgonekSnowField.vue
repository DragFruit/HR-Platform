<template>
  <div ref="layerRef" class="ogsf" aria-hidden="true">
    <div
      v-for="f in flakes"
      :key="f.id"
      :ref="(el) => setEl(f.id, el)"
      class="ogsf__flake"
      :class="{ 'is-mine': f.author?.mine }"
      :style="{ width: `${f.size}px`, height: `${f.size}px` }"
    >
      <OgonekSprite :rows="f.rows" width-css="100%" by-value />
    </div>
  </div>
  <div v-if="tip" class="ogsf__tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">{{ tip.text }}</div>
</template>

<script setup lang="ts">
/**
 * Снег над календарём. Снежинки ивента постепенно уступают место снежинкам
 * участников: каждая авторская занимает два места базовых. Наведи — узнаешь,
 * чья. Своя подсвечена тёплым.
 *
 * Слой сквозной (`pointer-events: none`): подсказка ищется по координатам
 * курсора, а клик проходит к листкам. Ловить снежинки не нужно — это
 * сознательное решение спеки, повторять октябрьскую ловлю нельзя.
 */
import { OGONEK_BASE_FLAKE, ogonekFlakeSprite } from '~/events/ogonek/snowflake';

type Author = { by: string; q: string[]; mine?: boolean };

const props = withDefaults(defineProps<{ authors: Author[]; count?: number }>(), { count: 26 });

type Flake = {
  id: number;
  x: number;
  y: number;
  v: number;
  ph: number;
  size: number;
  paused: boolean;
  author: Author | null;
  rows: string[];
};

const layerRef = ref<HTMLElement | null>(null);
const flakes = ref<Flake[]>([]);
const tip = ref<{ x: number; y: number; text: string } | null>(null);
const els = new Map<number, HTMLElement>();
function setEl(id: number, el: unknown) {
  if (el instanceof HTMLElement) els.set(id, el);
  else els.delete(id);
}

const BASE_ROWS = ogonekFlakeSprite(OGONEK_BASE_FLAKE);

/** Раздаём авторские снежинки по местам: каждая забирает два места базовых. */
function assign() {
  const list = props.authors;
  const replaced = Math.min(props.count, list.length * 2);
  flakes.value.forEach((f, i) => {
    const a = i < replaced && list.length ? list[i % list.length]! : null;
    f.author = a;
    f.rows = a ? ogonekFlakeSprite(a.q) : BASE_ROWS;
  });
}

let raf = 0;
let last = 0;
let reduce = false;

function tick(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  const H = window.innerHeight;
  const W = window.innerWidth;
  for (const f of flakes.value) {
    if (!f.paused) {
      f.y += f.v * dt;
      f.ph += dt * 0.8;
      if (f.y > H + 30) { f.y = -30; f.x = Math.random() * W; }
    }
    const el = els.get(f.id);
    if (el) {
      el.style.transform = `translate(${f.x + Math.sin(f.ph) * 14}px, ${f.y}px) rotate(${Math.sin(f.ph * 0.7) * 25}deg)`;
    }
  }
  if (!reduce) raf = requestAnimationFrame(tick);
}

/** Подсказка по координатам курсора: слой при этом кликов не ловит. */
function onMove(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  let hit: Flake | null = null;
  for (const f of flakes.value) {
    const el = els.get(f.id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (e.clientX >= r.left - 4 && e.clientX <= r.right + 4 && e.clientY >= r.top - 4 && e.clientY <= r.bottom + 4) {
      hit = f;
      break;
    }
  }
  for (const f of flakes.value) f.paused = f === hit;
  if (!hit) { tip.value = null; return; }
  const r = els.get(hit.id)!.getBoundingClientRect();
  tip.value = {
    x: Math.min(Math.max(8, r.left + r.width / 2 - 110), window.innerWidth - 228),
    y: r.top > 40 ? r.top - 34 : r.bottom + 8,
    text: hit.author ? `Снежинку придумал(а): ${hit.author.by}` : 'Снежинка ивента. Свою можно вырезать в окне 12'
  };
}

onMounted(() => {
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    reduce = false;
  }
  const W = window.innerWidth;
  const H = window.innerHeight;
  flakes.value = Array.from({ length: props.count }, (_, i) => ({
    id: i,
    x: Math.random() * W,
    y: Math.random() * H,
    v: 10 + Math.random() * 16,
    ph: Math.random() * 6,
    size: 14 + Math.random() * 12,
    paused: false,
    author: null,
    rows: BASE_ROWS
  }));
  assign();
  last = performance.now();
  // Без движения снег просто стоит: и он, и подсказки на месте.
  nextTick(() => {
    if (reduce) tick(last);
    else raf = requestAnimationFrame(tick);
  });
  window.addEventListener('pointermove', onMove);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener('pointermove', onMove);
});

watch(() => props.authors, assign, { deep: true });
</script>

<style scoped>
.ogsf {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 40;
  overflow: hidden;
}

.ogsf__flake {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
  opacity: 0.9;
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.35));
}

.ogsf__flake.is-mine {
  filter: drop-shadow(0 0 4px rgba(255, 207, 74, 0.8));
}

.ogsf__tip {
  position: fixed;
  z-index: 75;
  pointer-events: none;
  font-family: var(--og-pixel);
  font-size: 9px;
  line-height: 1.6;
  background: var(--og-paper);
  color: var(--og-ink);
  padding: 7px 9px;
  box-shadow: 3px 3px 0 var(--og-shade);
  white-space: nowrap;
}
</style>
