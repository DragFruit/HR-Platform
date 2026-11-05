<template>
  <figure class="ogm">
    <div class="ogm__stage" :class="`is-${phase}`">
      <img class="ogm__shirt" :src="SHIRT_SRC" alt="Футболка с ковром VBI: Digital команда, «Создаём узор будущего»" />
      <canvas ref="canvasRef" class="ogm__weave" aria-hidden="true" />
      <p class="ogm__tada" aria-hidden="true">ТАДААМ!</p>
    </div>
    <figcaption class="ogm__cap">
      <span :class="{ 'is-shown': phase === 'done' }">Вот так рисунок с историей оказался на вашей футболке</span>
      <button type="button" class="ogm__again" :disabled="phase !== 'done'" @click="play">Ещё раз</button>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
/**
 * Окно 3: как появляется мерч. Сначала пусто, потом натягивается основа,
 * челнок ряд за рядом ткёт из нитей ковёр, а за ним проявляется футболка.
 *
 * Ковёр вырезан из той же фотографии футболки, поэтому в финале он точно
 * совпадает с принтом и незаметно передаёт ему место.
 *
 * При prefers-reduced-motion сразу показываем готовую футболку.
 */
const SHIRT_SRC = '/events/ogonek/merch/tshirt-digital.webp';

/** Где ковёр на фотографии 1200×1280. */
const PHOTO_W = 1200;
const PHOTO_H = 1280;
const BOX = { x: 412, y: 290, w: 394, h: 552 };

const WARP_MS = 900;
const WEAVE_MS = 3800;
const ROW_H = 6;
const WARP_STEP = 7;
/** Фон футболки темнее этого; белая кромка принта намного светлее. */
const BACKGROUND_LUMA = 120;

type Phase = 'idle' | 'weave' | 'shirt' | 'done';
const phase = ref<Phase>('idle');
const canvasRef = ref<HTMLCanvasElement | null>(null);

/** Ковёр без футболки вокруг и нитяная основа по его форме. */
let carpet: HTMLCanvasElement | null = null;
let warp: HTMLCanvasElement | null = null;
let raf = 0;
const timers: ReturnType<typeof setTimeout>[] = [];
let alive = true;

const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

function clearRun() {
  cancelAnimationFrame(raf);
  timers.splice(0).forEach(clearTimeout);
}

/**
 * Вырезаем ковёр заливкой от краёв: всё тёмное, до чего можно дойти снаружи,
 * это футболка. Тёмный узор внутри ковра заливка не достаёт: его отделяет
 * белая кромка принта.
 */
function buildCarpet(img: HTMLImageElement) {
  const c = document.createElement('canvas');
  c.width = BOX.w;
  c.height = BOX.h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, BOX.x, BOX.y, BOX.w, BOX.h, 0, 0, BOX.w, BOX.h);
  const data = ctx.getImageData(0, 0, BOX.w, BOX.h);
  const px = data.data;
  const seen = new Uint8Array(BOX.w * BOX.h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= BOX.w || y >= BOX.h) return;
    const i = y * BOX.w + x;
    if (seen[i]) return;
    const o = i * 4;
    const luma = 0.3 * px[o]! + 0.59 * px[o + 1]! + 0.11 * px[o + 2]!;
    if (luma > BACKGROUND_LUMA) return;
    seen[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < BOX.w; x++) { push(x, 0); push(x, BOX.h - 1); }
  for (let y = 0; y < BOX.h; y++) { push(0, y); push(BOX.w - 1, y); }
  while (stack.length) {
    const i = stack.pop()!;
    px[i * 4 + 3] = 0;
    const x = i % BOX.w;
    const y = (i - x) / BOX.w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  ctx.putImageData(data, 0, 0);
  carpet = c;

  // Основа — вертикальные нити только там, где будет ковёр
  const w = document.createElement('canvas');
  w.width = BOX.w;
  w.height = BOX.h;
  const wctx = w.getContext('2d')!;
  wctx.fillStyle = '#e8d7b4';
  for (let x = 2; x < BOX.w; x += WARP_STEP) wctx.fillRect(x, 0, 1, BOX.h);
  wctx.globalCompositeOperation = 'destination-in';
  wctx.drawImage(c, 0, 0);
  warp = w;
}

function drawWarp(ctx: CanvasRenderingContext2D, p: number) {
  if (!warp) return;
  // Нити натягиваются сверху вниз, каждая со своей небольшой задержкой
  for (let x = 2; x < BOX.w; x += WARP_STEP) {
    const lag = (x / BOX.w) * 0.35;
    const k = Math.min(1, Math.max(0, (p - lag) / (1 - 0.35)));
    if (k <= 0) continue;
    ctx.drawImage(warp, x, 0, 1, BOX.h * k, x, 0, 1, BOX.h * k);
  }
}

function drawWeave(ctx: CanvasRenderingContext2D, p: number) {
  if (!carpet) return;
  ctx.globalAlpha = 0.55;
  ctx.drawImage(warp!, 0, 0);
  ctx.globalAlpha = 1;

  const rows = Math.ceil(BOX.h / ROW_H);
  const exact = p * rows;
  const full = Math.floor(exact);
  const part = exact - full;
  const doneH = Math.min(BOX.h, full * ROW_H);
  if (doneH > 0) ctx.drawImage(carpet, 0, 0, BOX.w, doneH, 0, 0, BOX.w, doneH);
  if (full >= rows) return;

  // Текущий ряд: челнок идёт то вправо, то влево и тянет за собой уток
  const y = full * ROW_H;
  const toRight = full % 2 === 0;
  const w = BOX.w * part;
  const x = toRight ? 0 : BOX.w - w;
  ctx.drawImage(carpet, x, y, w, ROW_H, x, y, w, ROW_H);
  const tip = toRight ? w : BOX.w - w;
  ctx.fillStyle = '#ffcf4a';
  ctx.fillRect(0, y + ROW_H - 1, BOX.w, 1);
  ctx.fillStyle = '#f5efe3';
  ctx.fillRect(tip - 7, y, 14, ROW_H);
}

function runFrames(ms: number, draw: (ctx: CanvasRenderingContext2D, p: number) => void, done: () => void) {
  const canvas = canvasRef.value;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  const start = performance.now();
  const tick = (t: number) => {
    if (!alive) return;
    const p = Math.min(1, (t - start) / ms);
    ctx.clearRect(0, 0, BOX.w, BOX.h);
    draw(ctx, p);
    if (p < 1) raf = requestAnimationFrame(tick);
    else done();
  };
  raf = requestAnimationFrame(tick);
}

function play() {
  clearRun();
  const canvas = canvasRef.value;
  if (!canvas || !carpet) {
    phase.value = 'done';
    return;
  }
  canvas.width = BOX.w;
  canvas.height = BOX.h;
  phase.value = 'idle';
  later(500, () => {
    phase.value = 'weave';
    runFrames(WARP_MS, drawWarp, () => {
      runFrames(WEAVE_MS, drawWeave, () => {
        phase.value = 'shirt';
        later(1500, () => { phase.value = 'done'; });
      });
    });
  });
}

onMounted(() => {
  let reduce = false;
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    reduce = false;
  }
  if (reduce) {
    phase.value = 'done';
    return;
  }
  const img = new Image();
  img.onload = () => {
    if (!alive) return;
    try {
      buildCarpet(img);
      play();
    } catch {
      // Canvas недоступен — просто показываем футболку.
      phase.value = 'done';
    }
  };
  img.onerror = () => { phase.value = 'done'; };
  img.src = SHIRT_SRC;
});

onBeforeUnmount(() => {
  alive = false;
  clearRun();
});

// Позиция ковра на сцене — те же доли, что на фотографии.
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const weaveLeft = pct(BOX.x, PHOTO_W);
const weaveTop = pct(BOX.y, PHOTO_H);
const weaveWidth = pct(BOX.w, PHOTO_W);
const weaveHeight = pct(BOX.h, PHOTO_H);
</script>

<style scoped>
.ogm { margin: 0; display: flex; flex-direction: column; gap: 10px; max-width: 360px; }

.ogm__stage {
  position: relative;
  aspect-ratio: 1200 / 1280;
  background: var(--og-bg);
  border: 2px solid var(--og-line);
  box-shadow: 4px 4px 0 var(--og-shade);
  overflow: hidden;
}

.ogm__shirt {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 1.2s ease;
}

.ogm__weave {
  position: absolute;
  left: v-bind(weaveLeft);
  top: v-bind(weaveTop);
  width: v-bind(weaveWidth);
  height: v-bind(weaveHeight);
  transition: opacity 0.6s ease 0.9s;
}

.ogm__stage.is-shirt .ogm__shirt,
.ogm__stage.is-done .ogm__shirt { opacity: 1; }

/* Футболка проявилась — ковёр передаёт место принту на ней */
.ogm__stage.is-shirt .ogm__weave,
.ogm__stage.is-done .ogm__weave { opacity: 0; }

.ogm__tada {
  position: absolute;
  left: 50%;
  top: 6%;
  margin: 0;
  transform: translateX(-50%) scale(0.4);
  opacity: 0;
  font-family: var(--og-pixel);
  font-size: clamp(16px, 4vw, 26px);
  color: var(--og-gold);
  text-shadow: 0 0 18px rgba(255, 207, 74, 0.6), 3px 3px 0 #6b2a00;
  white-space: nowrap;
}

.ogm__stage.is-done .ogm__tada {
  animation: ogm-tada 1.8s cubic-bezier(0.2, 1.6, 0.4, 1) forwards;
}

@keyframes ogm-tada {
  0% { transform: translateX(-50%) scale(0.4); opacity: 0; }
  25% { transform: translateX(-50%) scale(1); opacity: 1; }
  75% { transform: translateX(-50%) scale(1); opacity: 1; }
  100% { transform: translateX(-50%) scale(1); opacity: 0; }
}

.ogm__cap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 38px;
  font-size: 15px;
  color: var(--og-snow);
}

.ogm__cap span { opacity: 0; transition: opacity 0.6s ease; }
.ogm__cap span.is-shown { opacity: 1; }

.ogm__again {
  flex: none;
  font-family: var(--og-pixel);
  font-size: 8px;
  padding: 8px 10px;
  background: transparent;
  color: #ffd9d6;
  border: 2px solid var(--og-line);
  cursor: pointer;
}

.ogm__again:disabled { opacity: 0.4; cursor: default; }

@media (prefers-reduced-motion: reduce) {
  .ogm__shirt, .ogm__weave, .ogm__cap span { transition: none; }
  .ogm__stage.is-done .ogm__tada { animation: none; }
}
</style>
