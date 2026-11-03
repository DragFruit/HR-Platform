<template>
  <div v-if="enabled" class="og-decor" aria-hidden="true">
    <!-- Гирлянда поверх шапки -->
    <div class="og-decor__garland" :style="garlandStyle" />

    <!-- Снегопад: три слоя глубины, у каждого своя скорость -->
    <!-- На странице адвента свой снег, с подписями снежинок: второй не нужен -->
    <canvas v-if="motionAllowed && !isAdvent" ref="canvasRef" class="og-decor__snow" />

    <!-- Камин: только на главной, в углу -->
    <ClientOnly>
      <OgonekFireplace v-if="isHome" class="og-decor__fire" :width="118" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
/**
 * Декор платформы: гирлянда над шапкой, снегопад поверх интерфейса, камин
 * в углу главной. Иней на карточках и колпак на аватарках вешаются стилями
 * через классы `ogonek` / `ogonek-hat` на <html> — рабочие компоненты для
 * этого трогать не нужно.
 *
 * Снег рисуется на canvas, а не сотней div-ов: так он не нагружает раскладку
 * страницы и не мешает скроллу.
 *
 * Снежинки ловить кликом нельзя и не нужно: слой полностью сквозной. Это
 * сознательное решение (спека, раздел 4b) — повторять октябрьскую ловлю
 * привидений в декабре значит убить новизну.
 */
import { OGONEK_DECOR, OGONEK_OBJECTS } from '~/events/ogonek/sprites';
import { ogonekSpriteUrl, ogonekSpriteUrlByValue } from '~/utils/ogonekRender';

const { enabled, motionAllowed, state } = useOgonekDecor();
const route = useRoute();
const isHome = computed(() => route.path === '/');
const isAdvent = computed(() => route.path.startsWith('/event/ogonek'));

const garlandStyle = computed(() => {
  const url = ogonekSpriteUrl(OGONEK_DECOR.garland);
  return url ? { backgroundImage: `url(${url})` } : {};
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
let raf = 0;
let flakes: Flake[] = [];
let images: HTMLImageElement[] = [];

type Flake = {
  x: number;
  y: number;
  /** Слой глубины: 0 дальний и мелкий, 2 ближний и крупный. */
  depth: number;
  size: number;
  speed: number;
  drift: number;
  phase: number;
  img: number;
};

/** Наши снежинки плюс авторские — метель постепенно становится авторской. */
function buildImages(): string[] {
  const own = ogonekSpriteUrl(OGONEK_OBJECTS.snowflake);
  const authored = state.value.authorFlakes.map((rows) => ogonekSpriteUrlByValue(rows));
  return [own, own, ...authored].filter(Boolean);
}

function seed(width: number, height: number) {
  const count = Math.round(Math.min(110, Math.max(36, (width * height) / 22000)));
  flakes = Array.from({ length: count }, () => spawn(width, height, true));
}

function spawn(width: number, height: number, anywhere = false): Flake {
  const depth = Math.floor(Math.random() * 3);
  return {
    x: Math.random() * width,
    y: anywhere ? Math.random() * height : -20,
    depth,
    size: [7, 11, 17][depth]!,
    speed: [10, 18, 30][depth]! * (0.75 + Math.random() * 0.5),
    drift: (Math.random() - 0.5) * 14,
    phase: Math.random() * Math.PI * 2,
    img: Math.floor(Math.random() * Math.max(1, images.length))
  };
}

function start() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed(window.innerWidth, window.innerHeight);
  };

  images = buildImages().map((src) => {
    const img = new Image();
    img.src = src;
    return img;
  });
  resize();
  window.addEventListener('resize', resize);

  let prev = performance.now();
  const tick = (t: number) => {
    const dt = Math.min(0.08, (t - prev) / 1000);
    prev = t;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    for (const f of flakes) {
      f.y += f.speed * dt;
      f.phase += dt * 0.8;
      f.x += (f.drift + Math.sin(f.phase) * 10) * dt;
      if (f.y > h + 24) Object.assign(f, spawn(w, h));
      if (f.x < -24) f.x = w + 20;
      if (f.x > w + 24) f.x = -20;
      const img = images[f.img % images.length];
      if (!img?.complete || !img.naturalWidth) continue;
      ctx.globalAlpha = [0.45, 0.68, 0.9][f.depth]!;
      ctx.drawImage(img, Math.round(f.x), Math.round(f.y), f.size, f.size);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  onBeforeUnmount(() => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  });
}

watch(
  [canvasRef, motionAllowed],
  ([canvas, motion]) => {
    if (canvas && motion) nextTick(start);
  },
  { immediate: true }
);
</script>

<style scoped>
.og-decor {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 60;
}

.og-decor__snow {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.og-decor__garland {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  /* Низкая: лампы висят над шапкой, но не садятся на её заголовок. */
  height: 32px;
  background-repeat: repeat-x;
  background-size: auto 32px;
  image-rendering: pixelated;
  /* Лампы мерцают тёплой волной, а не мигают по отдельности. */
  animation: og-garland 6s ease-in-out infinite;
}

@keyframes og-garland {
  0%, 100% { filter: brightness(1) drop-shadow(0 2px 6px rgba(217, 154, 43, 0.25)); }
  50% { filter: brightness(1.28) drop-shadow(0 2px 14px rgba(217, 154, 43, 0.5)); }
}

.og-decor__fire {
  position: absolute;
  right: 18px;
  bottom: 18px;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .og-decor__garland { animation: none; }
}

@media (max-width: 900px) {
  .og-decor__fire { display: none; }
  .og-decor__garland { height: 30px; background-size: auto 30px; }
}
</style>
