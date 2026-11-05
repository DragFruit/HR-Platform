<template>
  <div class="og-plug" :class="{ 'is-on': plugged }">
    <div ref="trackRef" class="og-plug__track">
      <canvas ref="cordRef" class="og-plug__cord" aria-hidden="true" />
      <span class="og-plug__wall" :style="{ top: `${anchor.y - 12}px` }" aria-hidden="true" />

      <button
        type="button"
        class="og-plug__handle"
        :class="{ 'is-dragging': dragging }"
        :style="{ transform: `translate(${pos.x}px, ${pos.y - PLUG_H / 2}px) rotate(${angle}rad)` }"
        :aria-label="plugged ? 'Вынуть вилку' : 'Воткнуть вилку в розетку'"
        :aria-pressed="plugged"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @keydown.enter.prevent="toggle"
        @keydown.space.prevent="toggle"
      >
        <OgonekSprite :rows="OGONEK_DECOR.plug" :width="PLUG_W" />
      </button>

      <!-- Розетка выше вилки: штыри уходят внутрь неё -->
      <OgonekSprite
        class="og-plug__socket"
        :rows="OGONEK_OBJECTS.socket"
        :width="SOCKET"
        alt="Розетка"
        :style="{ left: `${socketX}px`, top: `${socketY}px` }"
      />
      <span
        v-if="plugged"
        class="og-plug__spark"
        :style="{ left: `${socketX + SOCKET / 2}px`, top: `${socketY + SOCKET / 2}px` }"
        aria-hidden="true"
      />
    </div>

    <p class="og-plug__state" aria-live="polite">
      {{ plugged ? 'Вилка в розетке. Декор горит на всей платформе.' : 'Вилка вынута, всё погашено. Тяните её к розетке.' }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Вилка и розетка из окна 4. Декор включается не галочкой, а движением руки:
 * тянешь вилку, втыкаешь — горит всё; вынул — погасло всё (спека, раздел 4).
 *
 * Провод — настоящая верёвка (интегрирование Верле): провисает, тянется за
 * вилкой и ложится на пол. Вилку можно носить куда угодно, но длина провода
 * ограничена: дальше него не уйти. Брошенная вилка падает на пол.
 *
 * Включение решает сервер, поэтому `plugged` приходит пропсом; здесь только
 * физика и жест. С клавиатуры Enter и пробел просто переключают вилку.
 */
import { OGONEK_DECOR, OGONEK_OBJECTS } from '~/events/ogonek/sprites';
import { OGONEK_PALETTE } from '~/events/ogonek/palette';

const props = defineProps<{ plugged: boolean }>();
const emit = defineEmits<{ change: [on: boolean] }>();

/** Вилка 32×16 и розетка 32×32 — ровно в 3 раза, чтобы пиксель не плыл. */
const PLUG_W = 96;
const PLUG_H = 48;
const SOCKET = 96;
/** Где кончается корпус вилки: дальше только штыри, они уходят в розетку. */
const PLUG_BODY = 63;
/** Пиксель провода на экране: как у спрайтов. */
const CORD_PX = 3;
const SEGMENTS = 18;
const GRAVITY = 1100;
/** Ближе этого к гнезду вилка втыкается, дальше — вынута. */
const SNAP_IN = 70;
const PULL_OUT = 44;

const trackRef = ref<HTMLElement | null>(null);
const cordRef = ref<HTMLCanvasElement | null>(null);

const size = reactive({ w: 600, h: 210 });
const anchor = computed(() => ({ x: 8, y: Math.round(size.h * 0.32) }));
const socketX = computed(() => size.w - SOCKET - 16);
const socketY = computed(() => Math.round((size.h - SOCKET) / 2));
/** Положение вилки в гнезде: корпус упирается в розетку. */
const seat = computed(() => ({ x: socketX.value + 2 - PLUG_BODY, y: socketY.value + SOCKET / 2 }));
/** Длина провода: до гнезда хватает с запасом, но не бесконечно. */
const cordLength = computed(() =>
  Math.hypot(seat.value.x - anchor.value.x, seat.value.y - anchor.value.y) * 1.22
);

/** pos — точка, где провод входит в вилку (левый край спрайта). */
const pos = reactive({ x: 0, y: 0 });
const angle = ref(0);
const dragging = ref(false);

type Pt = { x: number; y: number; px: number; py: number };
let rope: Pt[] = [];
let fallV = 0;
let grabDx = 0;
let grabDy = 0;
let raf = 0;
let last = 0;
let calm = 0;
let reduceMotion = false;
/** За один рывок команда «вынуть» уходит один раз, а не на каждое движение. */
let pulled = false;

const floorY = () => size.h - PLUG_H / 2 - 4;

function clampToCord(x: number, y: number) {
  const cx = Math.min(size.w - PLUG_W / 2, Math.max(0, x));
  const cy = Math.min(floorY(), Math.max(PLUG_H / 2, y));
  const dx = cx - anchor.value.x;
  const dy = cy - anchor.value.y;
  const d = Math.hypot(dx, dy);
  const max = cordLength.value;
  if (d <= max) return { x: cx, y: cy };
  return { x: anchor.value.x + (dx / d) * max, y: anchor.value.y + (dy / d) * max };
}

function restSpot() {
  return clampToCord(size.w * 0.3, floorY());
}

function initRope() {
  rope = Array.from({ length: SEGMENTS + 1 }, (_, i) => {
    const t = i / SEGMENTS;
    const x = anchor.value.x + (pos.x - anchor.value.x) * t;
    const y = anchor.value.y + (pos.y - anchor.value.y) * t;
    return { x, y, px: x, py: y };
  });
}

function stepRope(dt: number) {
  const seg = cordLength.value / SEGMENTS;
  const floor = size.h - 5;
  for (let i = 1; i < SEGMENTS; i++) {
    const p = rope[i]!;
    const vx = (p.x - p.px) * 0.97;
    const vy = (p.y - p.py) * 0.97;
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy + GRAVITY * dt * dt;
  }
  const head = rope[0]!;
  const tail = rope[SEGMENTS]!;
  for (let it = 0; it < 14; it++) {
    head.x = anchor.value.x;
    head.y = anchor.value.y;
    tail.x = pos.x;
    tail.y = pos.y;
    for (let i = 0; i < SEGMENTS; i++) {
      const a = rope[i]!;
      const b = rope[i + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      // Только нерастяжимость: сжиматься провод может, тогда он провисает
      if (d <= seg) continue;
      const k = ((d - seg) / d) * 0.5;
      if (i > 0) {
        a.x += dx * k;
        a.y += dy * k;
      }
      if (i + 1 < SEGMENTS) {
        b.x -= dx * k;
        b.y -= dy * k;
      }
    }
    for (let i = 1; i < SEGMENTS; i++) rope[i]!.y = Math.min(floor, rope[i]!.y);
  }
}

function drawCord() {
  const canvas = cordRef.value;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx || !rope.length) return;
  const w = Math.ceil(size.w / CORD_PX);
  const h = Math.ceil(size.h / CORD_PX);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w * CORD_PX}px`;
    canvas.style.height = `${h * CORD_PX}px`;
  }
  ctx.clearRect(0, 0, w, h);
  const plot = (color: string, thick: number) => {
    ctx.fillStyle = color;
    const off = Math.floor(thick / 2);
    for (let i = 0; i < SEGMENTS; i++) {
      const a = rope[i]!;
      const b = rope[i + 1]!;
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / CORD_PX));
      for (let s = 0; s <= n; s++) {
        const x = Math.round((a.x + ((b.x - a.x) * s) / n) / CORD_PX);
        const y = Math.round((a.y + ((b.y - a.y) * s) / n) / CORD_PX);
        ctx.fillRect(x - off, y - off, thick, thick);
      }
    }
  };
  plot(OGONEK_PALETTE['0']!, 3);
  plot(OGONEK_PALETTE['6']!, 1);
}

function updateAngle(k: number) {
  let target = 0;
  if (!props.plugged || dragging.value) {
    const prev = rope[SEGMENTS - 2];
    if (prev) target = Math.atan2(pos.y - prev.y, pos.x - prev.x);
    // Вилка, лежащая на полу, не встаёт на попа
    if (!dragging.value) target *= 0.25;
  }
  angle.value += (target - angle.value) * k;
}

function frame(t: number) {
  const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
  last = t;

  if (!dragging.value && !props.plugged && pos.y < floorY()) {
    fallV += GRAVITY * dt;
    const p = clampToCord(pos.x, pos.y + fallV * dt);
    pos.x = p.x;
    pos.y = p.y;
    if (pos.y >= floorY() - 0.5) fallV = 0;
  } else if (!dragging.value) {
    fallV = 0;
  }

  const before = rope.reduce((sum, p) => sum + Math.abs(p.x - p.px) + Math.abs(p.y - p.py), 0);
  stepRope(dt);
  updateAngle(0.22);
  drawCord();

  // Всё улеглось — цикл засыпает, чтобы не жечь батарею в открытом окне.
  calm = before < 0.4 && !dragging.value && fallV === 0 ? calm + 1 : 0;
  if (calm > 30) {
    raf = 0;
    return;
  }
  raf = requestAnimationFrame(frame);
}

function wake() {
  calm = 0;
  if (reduceMotion) {
    // Без анимации: сразу конечное положение, как будто всё уже упало.
    if (!dragging.value && !props.plugged) {
      pos.y = clampToCord(pos.x, floorY()).y;
    }
    for (let i = 0; i < 80; i++) stepRope(0.016);
    updateAngle(1);
    drawCord();
    return;
  }
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

function placeForState() {
  const p = props.plugged ? seat.value : restSpot();
  pos.x = p.x;
  pos.y = p.y;
  fallV = 0;
  if (props.plugged) angle.value = 0;
}

function measure() {
  const t = trackRef.value;
  if (!t) return;
  size.w = t.clientWidth;
  size.h = t.clientHeight;
  placeForState();
  initRope();
  wake();
}

let ro: ResizeObserver | null = null;

onMounted(() => {
  try {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    reduceMotion = false;
  }
  measure();
  if (typeof ResizeObserver !== 'undefined' && trackRef.value) {
    ro = new ResizeObserver(measure);
    ro.observe(trackRef.value);
  }
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  ro?.disconnect();
});

watch(
  () => props.plugged,
  () => {
    if (dragging.value) return;
    placeForState();
    wake();
  }
);

const distToSeat = () => Math.hypot(pos.x - seat.value.x, pos.y - seat.value.y);

function pointerInTrack(e: PointerEvent) {
  const box = trackRef.value!.getBoundingClientRect();
  return { x: e.clientX - box.left, y: e.clientY - box.top };
}

function onDown(e: PointerEvent) {
  dragging.value = true;
  pulled = false;
  const at = pointerInTrack(e);
  grabDx = pos.x - at.x;
  grabDy = pos.y - at.y;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  wake();
}

function onMove(e: PointerEvent) {
  if (!dragging.value) return;
  const at = pointerInTrack(e);
  const p = clampToCord(at.x + grabDx, at.y + grabDy);
  pos.x = p.x;
  pos.y = p.y;
  // Выдернули — гаснет сразу, не дожидаясь, пока отпустят кнопку мыши.
  if (props.plugged && !pulled && distToSeat() > PULL_OUT) {
    pulled = true;
    emit('change', false);
  }
  wake();
}

function onUp() {
  if (!dragging.value) return;
  dragging.value = false;
  if (distToSeat() < SNAP_IN) {
    pos.x = seat.value.x;
    pos.y = seat.value.y;
    // Выдернули и тут же вернули: сервер ещё мог не ответить на «вынуть».
    if (!props.plugged || pulled) emit('change', true);
  }
  wake();
}

/** Клавиатурный вариант того же действия. */
function toggle() {
  emit('change', !props.plugged);
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
  height: 210px;
  background: var(--og-bg);
  border: 2px solid var(--og-line);
  overflow: hidden;
  /* Пол, на который ложатся провод и вилка */
  box-shadow: inset 0 -4px 0 var(--og-shade);
}

.og-plug__cord {
  position: absolute;
  left: 0;
  top: 0;
  image-rendering: pixelated;
  pointer-events: none;
}

.og-plug__wall {
  position: absolute;
  left: 0;
  width: 12px;
  height: 24px;
  background: var(--og-paper-2);
  border: 3px solid var(--og-shade);
  border-left: 0;
}

.og-plug__handle {
  position: absolute;
  left: 0;
  top: 0;
  width: 96px;
  height: 48px;
  padding: 0;
  border: 0;
  background: none;
  cursor: grab;
  touch-action: none;
  transform-origin: 0 50%;
}

.og-plug__handle.is-dragging { cursor: grabbing; }

.og-plug__socket {
  position: absolute;
  pointer-events: none;
}

.og-plug__spark {
  position: absolute;
  width: 70px;
  height: 70px;
  margin: -35px 0 0 -35px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 207, 74, 0.8), rgba(255, 207, 74, 0));
  pointer-events: none;
  animation: og-plug-spark 2.4s ease-in-out infinite;
}

@keyframes og-plug-spark {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 0.8; }
}

.og-plug__state {
  margin: 0;
  color: var(--og-muted);
  font-size: 15px;
}

.og-plug.is-on .og-plug__track { border-color: var(--og-gold); }

@media (prefers-reduced-motion: reduce) {
  .og-plug__spark { animation: none; opacity: 0.5; }
}
</style>
