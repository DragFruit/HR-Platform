<template>
  <div v-show="active" class="ps-party" aria-hidden="true">
    <canvas ref="confettiEl" class="ps-party__confetti" :width="CW" :height="CH" />
    <div class="ps-party__scene" :class="{ 'is-in': sceneIn }">
      <canvas ref="sceneEl" class="ps-party__canvas" :width="SW" :height="SH" />
    </div>
  </div>
  <p v-if="active" class="ps-party__sr" role="status">{{ bannerName }} — лучший гонщик!</p>
</template>

<script setup lang="ts">
import { drawPixelText, pixelTextWidth, GLYPH_H } from '~/events/pit-stop-14/pixelFont';

/** Сцена — 160×96 «пикселей», конфетти по карте — 320×180. */
const SW = 160;
const SH = 96;
const CW = 320;
const CH = 180;
const FPS_MS = 1000 / 12;
const TOTAL_MS = 5200;

const sceneEl = ref<HTMLCanvasElement | null>(null);
const confettiEl = ref<HTMLCanvasElement | null>(null);
const active = ref(false);
const sceneIn = ref(false);
const bannerName = ref('');

const PALETTE = ['#ddf365', '#7451f4', '#eeeee8', '#ff4fa3', '#ff8a1f', '#2fd6b4'];
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'];
const HAIR = ['#111111', '#5a3a1a', '#d9a441', '#7451f4', '#c0392b'];
const TIERS = [46, 58, 70];
const HOLDERS = [18, 136];

type Fan = { x: number; tier: number; shirt: string; skin: string; hair: string; delay: number; phase: number; holder: boolean };
type Bit = { x: number; y: number; vx: number; vy: number; c: string; flip: number };

let fans: Fan[] = [];
let sceneBits: Bit[] = [];
let mapBits: Bit[] = [];
let banner: HTMLCanvasElement | null = null;
let raf = 0;
let t0 = 0;
let lastFrame = -1;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)] as T;

const buildFans = () => {
  fans = [];
  TIERS.forEach((_, tier) => {
    for (let x = 3 + tier * 3; x < SW - 6; x += 9) {
      const holder = tier === 2 && HOLDERS.some((h) => Math.abs(h - x) < 5);
      fans.push({
        x: holder ? HOLDERS.find((h) => Math.abs(h - x) < 5)! : x,
        tier,
        shirt: pick(PALETTE),
        skin: pick(SKIN),
        hair: pick(HAIR),
        delay: holder ? 0 : Math.floor(Math.random() * 420),
        phase: Math.floor(Math.random() * 2),
        holder
      });
    }
  });
};

const buildBanner = (name: string) => {
  const line2 = 'ЛУЧШИЙ ГОНЩИК';
  const w = 136;
  const nameScale = pixelTextWidth(name, 2) <= w - 10 ? 2 : 1;
  const h = 8 + GLYPH_H * nameScale + 3 + GLYPH_H;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#111';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#eeeee8';
  g.fillRect(1, 1, w - 2, h - 2);
  g.fillStyle = '#ddf365';
  g.fillRect(1, 1, w - 2, 2);
  g.fillRect(1, h - 3, w - 2, 2);
  g.fillStyle = '#7451f4';
  drawPixelText(g, name, (w - pixelTextWidth(name, nameScale)) / 2, 4, nameScale);
  g.fillStyle = '#111';
  drawPixelText(g, line2, (w - pixelTextWidth(line2)) / 2, 4 + GLYPH_H * nameScale + 3, 1);
  banner = c;
};

const spawn = (arr: Bit[], w: number, n: number, fromTop: boolean) => {
  for (let i = 0; i < n; i++) {
    arr.push({
      x: Math.random() * w,
      y: fromTop ? -Math.random() * 20 : 30 + Math.random() * 20,
      vx: (Math.random() - 0.5) * 1.6,
      vy: fromTop ? 1 + Math.random() * 1.5 : -(2.5 + Math.random() * 2),
      c: pick(PALETTE),
      flip: Math.floor(Math.random() * 2)
    });
  }
};

const stepBits = (arr: Bit[], h: number) => {
  for (const b of arr) {
    b.x += b.vx;
    b.y += b.vy;
    b.vy = Math.min(2.2, b.vy + 0.25);
    b.vx += (Math.random() - 0.5) * 0.4;
    b.flip ^= 1;
  }
  return arr.filter((b) => b.y < h + 4);
};

const drawBits = (g: CanvasRenderingContext2D, arr: Bit[]) => {
  for (const b of arr) {
    g.fillStyle = b.c;
    if (b.flip) g.fillRect(Math.round(b.x), Math.round(b.y), 2, 1);
    else g.fillRect(Math.round(b.x), Math.round(b.y), 1, 2);
  }
};

/** 0…4 px — насколько болельщик привстал. */
const riseOf = (f: Fan, t: number) => {
  const up = Math.floor((t - 250 - f.delay) / 60);
  const down = Math.floor((t - 4250 - f.delay * 0.5) / 60);
  if (t < 4250) return Math.max(0, Math.min(4, up));
  return Math.max(0, 4 - down);
};

const drawFan = (g: CanvasRenderingContext2D, f: Fan, t: number, frame: number) => {
  const base = TIERS[f.tier]!;
  const r = riseOf(f, t);
  const x = f.x;
  g.fillStyle = f.shirt;
  g.fillRect(x, base - 3 - r, 6, 5 + r);
  g.fillStyle = f.skin;
  g.fillRect(x + 1, base - 7 - r, 4, 4);
  g.fillStyle = f.hair;
  g.fillRect(x + 1, base - 7 - r, 4, 1);
  g.fillStyle = '#111';
  g.fillRect(x + 2, base - 5 - r, 1, 1);
  g.fillRect(x + 4, base - 5 - r, 1, 1);
  if (r < 3) return;
  const top = base - 3 - r;
  if (f.holder) {
    g.fillStyle = f.shirt;
    g.fillRect(x - 1, top - 4, 1, 5);
    g.fillRect(x + 6, top - 4, 1, 5);
    g.fillStyle = f.skin;
    g.fillRect(x - 1, top - 5, 1, 1);
    g.fillRect(x + 6, top - 5, 1, 1);
    return;
  }
  const wave = (frame + f.phase) % 2 === 0;
  g.fillStyle = f.shirt;
  g.fillRect(x - 1, top - (wave ? 4 : 2), 1, wave ? 5 : 3);
  g.fillRect(x + 6, top - (wave ? 2 : 4), 1, wave ? 3 : 5);
  g.fillStyle = f.skin;
  g.fillRect(x - 1, top - (wave ? 5 : 3), 1, 1);
  g.fillRect(x + 6, top - (wave ? 3 : 5), 1, 1);
};

const bannerTop = (t: number) => {
  const hidden = 72;
  const up = 8;
  if (t < 450) return hidden;
  if (t < 4000) return Math.max(up, hidden - Math.floor((t - 450) / 40) * 4);
  return Math.min(hidden, up + Math.floor((t - 4000) / 40) * 4);
};

const drawBanner = (g: CanvasRenderingContext2D, t: number, frame: number) => {
  if (!banner) return;
  const bob = [0, -1, -2, -1][Math.floor(frame / 3) % 4]!;
  const top = bannerTop(t) + bob;
  const left = Math.round((SW - banner.width) / 2);
  const bottom = top + banner.height;
  g.fillStyle = '#3b2a1a';
  for (const hx of HOLDERS) {
    const poleX = hx === HOLDERS[0] ? hx - 1 : hx + 6;
    g.fillRect(poleX, top + 2, 1, Math.max(0, TIERS[2]! - 9 - top));
  }
  const strip = 8;
  for (let sx = 0; sx < banner.width; sx += strip) {
    const dy = Math.round(Math.sin(frame * 0.9 + sx * 0.12));
    g.drawImage(banner, sx, 0, strip, banner.height, left + sx, top + dy, strip, banner.height);
  }
  void bottom;
};

const drawScene = (t: number, frame: number) => {
  const g = sceneEl.value?.getContext('2d');
  if (!g) return;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#2a1f5c';
  g.fillRect(0, 0, SW, 24);
  g.fillStyle = '#33267a';
  g.fillRect(0, 24, SW, 24);
  g.fillStyle = '#eeeee8';
  for (const [sx, sy] of [[9, 5], [31, 13], [57, 4], [88, 10], [113, 3], [139, 12], [151, 6]]) {
    if ((frame + sx) % 8 !== 0) g.fillRect(sx!, sy!, 1, 1);
  }
  g.fillStyle = '#ddf365';
  g.fillRect(4, 18, 4, 2);
  g.fillRect(SW - 8, 18, 4, 2);
  g.fillStyle = '#6b6b70';
  g.fillRect(5, 20, 2, 28);
  g.fillRect(SW - 7, 20, 2, 28);

  TIERS.forEach((ty, tier) => {
    g.fillStyle = tier % 2 ? '#4a4a4f' : '#55555a';
    g.fillRect(0, ty, SW, 12);
    g.fillStyle = '#6b6b70';
    g.fillRect(0, ty, SW, 1);
    if (tier === 2) drawBanner(g, t, frame);
    for (const f of fans) if (f.tier === tier) drawFan(g, f, t, frame);
  });

  g.fillStyle = '#111';
  g.fillRect(0, 82, SW, 1);
  g.fillStyle = '#7451f4';
  g.fillRect(0, 83, SW, 13);
  g.fillStyle = '#ddf365';
  g.fillRect(0, 86, SW, 2);
  for (let x = 0; x < SW; x += 8) {
    g.fillStyle = (x / 8) % 2 ? '#111' : '#eeeee8';
    g.fillRect(x, 91, 4, 2);
    g.fillStyle = (x / 8) % 2 ? '#eeeee8' : '#111';
    g.fillRect(x + 4, 91, 4, 2);
  }

  drawBits(g, sceneBits);
};

const drawConfetti = () => {
  const g = confettiEl.value?.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, CW, CH);
  drawBits(g, mapBits);
};

const tick = (ts: number) => {
  raf = requestAnimationFrame(tick);
  const t = ts - t0;
  const frame = Math.floor(t / FPS_MS);
  if (frame === lastFrame) return;
  lastFrame = frame;
  if (t > 300 && t < 2600 && frame % 2 === 0) {
    spawn(mapBits, CW, 14, true);
    spawn(sceneBits, SW, 4, false);
  }
  mapBits = stepBits(mapBits, CH);
  sceneBits = stepBits(sceneBits, SH);
  drawScene(t, frame);
  drawConfetti();
  if (t > TOTAL_MS) stop();
};

const stop = () => {
  cancelAnimationFrame(raf);
  raf = 0;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
  active.value = false;
  sceneIn.value = false;
  mapBits = [];
  sceneBits = [];
};

const play = async (name: string) => {
  stop();
  bannerName.value = name.trim().toUpperCase().slice(0, 18) || 'ПИЛОТ';
  buildFans();
  buildBanner(bannerName.value);
  active.value = true;
  await nextTick();
  requestAnimationFrame(() => {
    sceneIn.value = true;
  });
  hideTimer = setTimeout(() => {
    sceneIn.value = false;
  }, TOTAL_MS - 600);
  t0 = performance.now();
  lastFrame = -1;
  raf = requestAnimationFrame(tick);
};

onBeforeUnmount(stop);

defineExpose({ play });
</script>

<style scoped>
.ps-party {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
  overflow: hidden;
}
.ps-party__confetti,
.ps-party__canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
.ps-party__confetti {
  position: absolute;
  inset: 0;
}
.ps-party__scene {
  position: absolute;
  left: 50%;
  bottom: 13%;
  width: 54%;
  aspect-ratio: 160 / 96;
  border: 3px solid #111;
  box-shadow: 5px 5px 0 #ddf365;
  background: #2a1f5c;
  transform: translate(-50%, 130%);
  transition: transform 0.42s steps(6, end);
}
.ps-party__scene.is-in {
  transform: translate(-50%, 0);
}
.ps-party__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
@media (max-width: 720px) {
  .ps-party__scene {
    width: 70%;
    border-width: 2px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ps-party__scene {
    transition: none;
  }
}
</style>
