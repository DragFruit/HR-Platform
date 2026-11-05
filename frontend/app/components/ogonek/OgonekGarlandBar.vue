<template>
  <div ref="sentinelRef" class="ogg-sentinel" aria-hidden="true" />
  <div ref="barRef" class="ogg" :class="{ 'is-stuck': stuck }">
    <div class="ogg__stage" :style="{ height: `${ROWS * SCALE}px` }" aria-hidden="true">
      <canvas ref="canvasRef" class="ogg__canvas" />
      <template v-if="power">
        <span
          v-for="g in glows"
          :key="g.id"
          class="ogg__glow"
          :style="{
            left: `${g.x}px`,
            top: `${g.y}px`,
            '--c': g.color,
            animationDelay: `${g.delay}s`
          }"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Гирлянда-прогресс: огонёк N — окно N, загорается, когда в окне выполнено
 * действие. Нарисована как гирлянда в шапке сайта (OGONEK_DECOR.garland):
 * тот же провод с той же провисающей дугой, та же лампа пиксель в пиксель,
 * те же четыре цвета. Разница одна: лампы горят не все сразу.
 *
 * Рисуется на canvas в низком разрешении и увеличивается целым множителем,
 * свечение — отдельные элементы поверх: так оно плавное, а лампа остаётся
 * резкой. Вилка вынута — свечения нет, выполненные просто цветные.
 *
 * Это не баллы и не лидерборд: свою гирлянду видит только сам человек.
 */
import { OGONEK_PALETTE } from '~/events/ogonek/palette';
import type { OgonekDayView } from '~/events/ogonek/types';

const props = withDefaults(defineProps<{ days: OgonekDayView[]; power?: boolean }>(), { power: true });

const SCALE = 2;
const ROWS = 22;
/** Длина дуги провода — как у тайла гирлянды в шапке. */
const WIRE_PERIOD = 48;

/** Лампа из спрайта гирлянды: L — блик, B — база, S — тень, 0 — контур. */
const BULB = [
  '..000..',
  '..000..',
  '.0LLB0.',
  '.LLBBB.',
  '0LBBBS0',
  '0LBBBS0',
  '0LBBBS0',
  '.BBBSS.',
  '.0BSS0.',
  '..000..'
];
const BULB_W = 7;

/** Цвета в порядке шапки: бордо, бирюза, охра, персик. */
const TONES = [
  { L: '3', B: '2', S: '1' },
  { L: 'c', B: 'b', S: 'a' },
  { L: '9', B: '8', S: '7' },
  { L: 'f', B: 'h', S: 'g' }
];

const toneOf = (id: number) => TONES[(id - 1) % TONES.length]!;
const wireY = (x: number) => Math.round(3 + 5 * Math.sin((Math.PI * (x % WIRE_PERIOD)) / WIRE_PERIOD));

const sentinelRef = ref<HTMLElement | null>(null);
const barRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const stuck = ref(false);
/** Ширина сцены в пикселях гирлянды. */
const cols = ref(0);

/** Лампа висит на проводе там, где он проходит над её колонкой. */
function bulbPos(index: number) {
  const span = cols.value / props.days.length;
  const x = Math.round(span * (index + 0.5) - BULB_W / 2);
  return { x, y: wireY(x + 3) + 2 };
}

const glows = computed(() => {
  if (!cols.value) return [];
  return props.days.flatMap((d, i) => {
    if (!d.done) return [];
    const { x, y } = bulbPos(i);
    return [{
      id: d.id,
      x: (x + BULB_W / 2) * SCALE,
      y: (y + 6) * SCALE,
      color: OGONEK_PALETTE[toneOf(d.id).B]!,
      // Волна по гирлянде, а не мигание по отдельности
      delay: -(i * 0.45)
    }];
  });
});

function paint() {
  const canvas = canvasRef.value;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx || !cols.value) return;
  canvas.width = cols.value;
  canvas.height = ROWS;
  canvas.style.width = `${cols.value * SCALE}px`;
  canvas.style.height = `${ROWS * SCALE}px`;
  ctx.clearRect(0, 0, cols.value, ROWS);

  const dot = (x: number, y: number, key: string) => {
    ctx.fillStyle = OGONEK_PALETTE[key]!;
    ctx.fillRect(x, y, 1, 1);
  };

  for (let x = 0; x < cols.value; x++) {
    const y = wireY(x);
    dot(x, y, '5');
    dot(x, y + 1, '0');
  }

  props.days.forEach((d, i) => {
    const { x, y } = bulbPos(i);
    const t = toneOf(d.id);
    // Не горит — лампа в тени своего цвета. Вилка вынута — без блика.
    const map = !d.done
      ? { L: t.S, B: t.S, S: t.S }
      : props.power ? t : { L: t.B, B: t.B, S: t.S };
    BULB.forEach((row, ry) => {
      [...row].forEach((c, rx) => {
        if (c === '.') return;
        if (c === '0') {
          dot(x + rx, y + ry, '0');
          return;
        }
        ctx.globalAlpha = d.done ? 1 : 0.6;
        dot(x + rx, y + ry, map[c as 'L' | 'B' | 'S']);
        ctx.globalAlpha = 1;
      });
    });
  });
}

function measure() {
  const w = barRef.value?.clientWidth ?? 0;
  cols.value = Math.floor(w / SCALE);
}

watch([cols, () => props.days.map((d) => d.done).join(), () => props.power], paint, { flush: 'post' });

let io: IntersectionObserver | null = null;
let ro: ResizeObserver | null = null;

onMounted(() => {
  measure();
  paint();
  if (typeof ResizeObserver !== 'undefined' && barRef.value) {
    ro = new ResizeObserver(measure);
    ro.observe(barRef.value);
  }
  if (!sentinelRef.value || typeof IntersectionObserver === 'undefined') return;
  // Гирлянда липнет под шапкой платформы, а не к краю окна — на ту же
  // высоту сдвигаем и линию, по которой ловим «прилипла».
  const top = parseFloat(barRef.value ? getComputedStyle(barRef.value).top : '0') || 0;
  io = new IntersectionObserver(([e]) => { stuck.value = !e?.isIntersecting; }, {
    rootMargin: `-${Math.round(top)}px 0px 0px 0px`
  });
  io.observe(sentinelRef.value);
});

onBeforeUnmount(() => {
  io?.disconnect();
  ro?.disconnect();
});

const reduce = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Центр лампы на экране. */
function bulbCenter(id: number) {
  const index = props.days.findIndex((d) => d.id === id);
  const box = canvasRef.value?.getBoundingClientRect();
  if (index < 0 || !box) return null;
  const { x, y } = bulbPos(index);
  return { cx: box.left + (x + BULB_W / 2) * SCALE, cy: box.top + (y + 6) * SCALE };
}

/** Лампа на экране — значит «пуф» можно показать сразу. */
function isVisible(id: number): boolean {
  const c = bulbCenter(id);
  return Boolean(c && c.cy > 0 && c.cy < window.innerHeight);
}

/** Облачко пикселей: огонёк загорается. */
function puff(id: number) {
  const c = bulbCenter(id);
  if (!c || reduce()) return;
  const col = OGONEK_PALETTE[toneOf(id).L]!;
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('i');
    p.className = 'ogg-puff';
    p.style.background = i % 3 ? 'rgba(255,240,230,.9)' : col;
    p.style.left = `${c.cx}px`;
    p.style.top = `${c.cy}px`;
    document.body.appendChild(p);
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 12 + Math.random() * 14;
    const s = 1 + Math.random() * 1.5;
    p.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist - 6}px)) scale(${s})`,
          opacity: 0
        }
      ],
      { duration: 550 + Math.random() * 250, easing: 'cubic-bezier(.1,.7,.3,1)' }
    ).onfinish = () => p.remove();
  }
}

defineExpose({ puff, isVisible });
</script>

<style scoped>
.ogg-sentinel { height: 0; }

.ogg {
  position: sticky;
  /* Высоту липкой шапки платформы подставляет страница */
  top: var(--og-sticky-top, 0px);
  z-index: 44;
  transition: background 0.2s;
}

.ogg.is-stuck {
  background: var(--og-bg);
  box-shadow: 0 4px 0 var(--og-shade);
}

.ogg__stage { position: relative; overflow: hidden; }

.ogg__canvas {
  /* Вне потока: иначе ширина канвы не даёт странице сжаться при ресайзе */
  position: absolute;
  left: 0;
  top: 0;
  image-rendering: pixelated;
}

.ogg__glow {
  position: absolute;
  width: 34px;
  height: 34px;
  margin: -17px 0 0 -17px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--c) 0, transparent 68%);
  pointer-events: none;
  animation: ogg-glow 6s ease-in-out infinite;
}

/* Та же тёплая волна, что у гирлянды в шапке */
@keyframes ogg-glow {
  0%, 100% { opacity: 0.32; }
  50% { opacity: 0.72; }
}

@media (prefers-reduced-motion: reduce) {
  .ogg { transition: none; }
  .ogg__glow { animation: none; opacity: 0.5; }
}
</style>

<style>
.ogg-puff {
  position: fixed;
  width: 4px;
  height: 4px;
  z-index: 70;
  pointer-events: none;
}
</style>
