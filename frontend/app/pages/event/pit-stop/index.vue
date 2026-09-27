<template>
  <div class="ps-hub">
    <div ref="stageEl" class="ps-hub__stage">
      <div class="ps-hub__map" :style="mapStyle">
        <img
          class="ps-hub__track"
          src="/events/pit-stop-14/track.png?v=5"
          alt=""
          width="1280"
          height="720"
          draggable="false"
        />

        <template v-for="item in hub" :key="item.id">
          <NuxtLink
            v-if="canOpen(item)"
            :to="`/event/pit-stop/${item.id}`"
            class="ps-hub__pin"
            :class="[
              `is-${item.status}`,
              { 'is-current': isCurrent(item), 'is-pulse': pulseId === item.id }
            ]"
            :style="pinStyle(item.id)"
            :title="shortTitle(item.title)"
            :aria-label="`${shortTitle(item.title)} — ${statusLabel(item.status)}`"
          >
            <span class="ps-hub__flag" aria-hidden="true">
              <svg viewBox="0 0 28 36" width="100%" height="100%" fill="none">
                <path class="ps-hub__flag-pole" d="M4 2v32" stroke-width="2.2" stroke-linecap="round" />
                <path class="ps-hub__flag-cloth" d="M5 3.5 L24 11.5 L5 19.5 Z" />
              </svg>
            </span>
          </NuxtLink>
          <button
            v-else
            type="button"
            class="ps-hub__pin is-locked"
            :class="{ 'is-pulse': pulseId === item.id }"
            :style="pinStyle(item.id)"
            disabled
            :title="item.lockedLabel || 'Закрыто'"
            :aria-label="`${shortTitle(item.title)} — закрыто`"
          >
            <span class="ps-hub__flag" aria-hidden="true">
              <svg viewBox="0 0 28 36" width="100%" height="100%" fill="none">
                <path class="ps-hub__flag-pole" d="M4 2v32" stroke-width="2.2" stroke-linecap="round" />
                <path class="ps-hub__flag-cloth" d="M5 3.5 L24 11.5 L5 19.5 Z" />
              </svg>
            </span>
          </button>
        </template>

        <PitStopHubDrive />
      </div>
    </div>

    <div v-if="showIntro" class="ps-hub__intro">
      <PitStopRaccoonGuide
        size="hub"
        :line="introLine"
        :show-nav="true"
        :can-skip="true"
        :next-label="introNextLabel"
        @next="onIntroNext"
        @skip="dismissIntro"
      />
    </div>

    <p v-if="loadError" class="ps-hub__err ps-hub__err--float">{{ loadError }}</p>
  </div>
</template>

<script setup lang="ts">
import { RACCOON_INTRO_STORAGE_KEY, RACCOON_LORE_LINES } from '~/events/pit-stop-14/raccoonLines';

definePageMeta({ layout: 'default' });

const INTRO_KEY = RACCOON_INTRO_STORAGE_KEY;

/** % от PNG — против часовой: 1 старт … 5 дозаправка → 6 пасхалка → 7 пазл → 8 финиш */
const PIN_POS: Record<number, { left: number; top: number }> = {
  1: { left: 32.0, top: 20.6 },
  2: { left: 63.8, top: 20.7 },
  3: { left: 84.1, top: 39.6 },
  4: { left: 84.1, top: 59.9 },
  5: { left: 56.6, top: 88.6 },
  6: { left: 23.7, top: 88.6 },
  7: { left: 16.2, top: 60.3 },
  8: { left: 34.3, top: 39.4 }
};

type HubItem = {
  id: number;
  title: string;
  unlockDate: string;
  unlocked: boolean;
  lockedLabel: string;
  status: string;
};

const hub = ref<HubItem[]>([]);
const loadError = ref('');
const stageEl = ref<HTMLElement | null>(null);
const mapStyle = ref<Record<string, string>>({});
const showIntro = ref(false);
const introStep = ref(0);
const pulseId = ref<number | null>(null);
let pulseTimer: ReturnType<typeof setTimeout> | null = null;

const route = useRoute();
const router = useRouter();

const TRACK_AR = 1280 / 720;

const introLine = computed(() => RACCOON_LORE_LINES[introStep.value] || RACCOON_LORE_LINES[0]);
const introNextLabel = computed(() =>
  introStep.value >= RACCOON_LORE_LINES.length - 1 ? 'Поехали' : 'Дальше'
);

const dismissIntro = () => {
  showIntro.value = false;
  if (import.meta.client) localStorage.setItem(INTRO_KEY, '1');
};

const onIntroNext = () => {
  if (introStep.value >= RACCOON_LORE_LINES.length - 1) {
    dismissIntro();
    return;
  }
  introStep.value += 1;
};

const fitMap = () => {
  const stage = stageEl.value;
  if (!stage) return;
  const cs = getComputedStyle(stage);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const aw = stage.clientWidth - padX;
  const ah = stage.clientHeight - padY;
  if (aw < 48 || ah < 48) return;
  let w = aw;
  let h = w / TRACK_AR;
  if (h > ah) {
    h = ah;
    w = h * TRACK_AR;
  }
  mapStyle.value = {
    width: `${Math.floor(w)}px`,
    height: `${Math.floor(h)}px`
  };
};

let stageRo: ResizeObserver | null = null;

const consumePulseQuery = () => {
  const raw = route.query.pulse;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(n) || n < 1 || n > 8) return;
  pulseId.value = n;
  void router.replace({ path: '/event/pit-stop', query: {} });
  if (pulseTimer) clearTimeout(pulseTimer);
  // одна волна подсветки, потом гасим
  pulseTimer = setTimeout(() => {
    pulseId.value = null;
    pulseTimer = null;
  }, 3200);
};

onMounted(() => {
  if (import.meta.client && !localStorage.getItem(INTRO_KEY)) {
    showIntro.value = true;
  }
  consumePulseQuery();
  void load();
  nextTick(() => {
    fitMap();
    requestAnimationFrame(fitMap);
  });
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    stageRo = new ResizeObserver(() => fitMap());
    stageRo.observe(stageEl.value);
  } else {
    nextTick(() => {
      if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
        stageRo = new ResizeObserver(() => fitMap());
        stageRo.observe(stageEl.value);
      }
    });
  }
  window.addEventListener('resize', fitMap);
});

onBeforeUnmount(() => {
  stageRo?.disconnect();
  window.removeEventListener('resize', fitMap);
  if (pulseTimer) clearTimeout(pulseTimer);
});

const shortTitle = (t: string) => t.replace(/^Чек-поинт\s+\d+:\s*/i, '');

const statusLabel = (s: string) => {
  if (s === 'done') return 'Пройдено';
  if (s === 'pending_review') return 'На проверке HR';
  if (s === 'in_progress') return 'В процессе';
  if (s === 'stopped') return 'Стоп';
  return 'Открыто';
};

const pinStyle = (id: number) => {
  const p = PIN_POS[id] ?? { left: 50, top: 50 };
  return { left: `${p.left}%`, top: `${p.top}%` };
};

const canOpen = (item: HubItem) =>
  item.unlocked && item.status !== 'locked' && item.status !== 'stopped';

const isCurrent = (item: HubItem) =>
  canOpen(item) && item.status !== 'done' && item.status !== 'pending_review';

const load = async () => {
  loadError.value = '';
  try {
    await $fetch('/api/event/pit-stop/join', {
      method: 'POST',
      body: { isRemote: false }
    });
    const data = await $fetch<{ hub: HubItem[] }>('/api/event/pit-stop/me');
    hub.value = data.hub;
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : 'Не удалось загрузить ивент';
  }
};

watch(hub, () => nextTick(fitMap));
</script>

<style scoped>
.ps-hub {
  --ps-bg: #1d1d1f;
  --ps-lime: #ddf365;
  --ps-violet: #7451f4;
  --ps-pin-w: clamp(22px, 3.4vmin, 34px);
  --ps-pin-h: clamp(30px, 4.6vmin, 44px);
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  background: var(--ps-bg);
  color: #fff;
  overscroll-behavior-y: contain;
  touch-action: manipulation;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ps-hub__stage {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: grid;
  place-items: center;
  padding: calc(var(--ps-pin-h) * 0.55 + 8px) calc(var(--ps-pin-w) * 0.7 + 10px);
  box-sizing: border-box;
  overflow: hidden;
  background: var(--ps-bg);
}

.ps-hub__map {
  position: relative;
  box-sizing: border-box;
  line-height: 0;
  max-width: 100%;
  max-height: 100%;
  background: transparent;
}

.ps-hub__track {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  user-select: none;
  pointer-events: none;
}

.ps-hub__pin {
  position: absolute;
  z-index: 2;
  width: var(--ps-pin-w);
  height: var(--ps-pin-h);
  margin: 0;
  padding: 0;
  border: 0;
  /* якорь у основания древка */
  transform: translate(-18%, -92%);
  display: block;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  background: transparent;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transform-origin: 14% 94%;
}

.ps-hub__flag {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: 14% 94%;
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.45));
  transition: filter 0.15s ease;
}

.ps-hub__flag-pole {
  stroke: #eeeee8;
}

.ps-hub__flag-cloth {
  fill: var(--ps-lime);
  stroke: #111;
  stroke-width: 1.4;
  stroke-linejoin: round;
}

.ps-hub__pin.is-current .ps-hub__flag-cloth {
  fill: #fff;
  stroke: var(--ps-violet);
}

.ps-hub__pin.is-current .ps-hub__flag {
  animation: ps-flag-sway 1.35s ease-in-out infinite;
}

.ps-hub__pin.is-pulse .ps-hub__flag-cloth {
  fill: #fff;
  stroke: var(--ps-violet);
  stroke-width: 2;
}

.ps-hub__pin.is-pulse .ps-hub__flag {
  animation: ps-flag-pulse 0.7s ease-in-out 4;
  filter: drop-shadow(0 0 10px rgba(221, 243, 101, 0.85)) drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.45));
  z-index: 5;
}

.ps-hub__pin.is-done .ps-hub__flag-cloth {
  fill: #388073;
  stroke: #111;
}

.ps-hub__pin.is-locked {
  cursor: not-allowed;
  opacity: 0.78;
}

.ps-hub__pin.is-locked .ps-hub__flag-cloth {
  fill: #6a6a6a;
  stroke: #333;
}

.ps-hub__pin.is-locked .ps-hub__flag-pole {
  stroke: #9a9a9a;
}

.ps-hub__pin:hover .ps-hub__flag,
.ps-hub__pin:focus-visible .ps-hub__flag {
  animation: ps-flag-tremble 0.42s ease-in-out infinite;
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.55));
}

.ps-hub__pin:not(.is-locked):focus-visible {
  outline: 2px solid var(--ps-violet);
  outline-offset: 4px;
  border-radius: 4px;
}

@keyframes ps-flag-tremble {
  0%,
  100% {
    transform: rotate(-7deg);
  }
  25% {
    transform: rotate(8deg);
  }
  50% {
    transform: rotate(-5deg);
  }
  75% {
    transform: rotate(6deg);
  }
}

@keyframes ps-flag-sway {
  0%,
  100% {
    transform: rotate(-4deg);
  }
  50% {
    transform: rotate(5deg);
  }
}

@keyframes ps-flag-pulse {
  0%,
  100% {
    transform: rotate(-6deg) scale(1);
  }
  50% {
    transform: rotate(8deg) scale(1.35);
  }
}

.ps-hub__err {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: #a11;
}

.ps-hub__err--float {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: 5;
  padding: 10px 12px;
  background: #ffe0e0;
  border: 2px solid #111;
  border-radius: 10px;
  color: #111;
  line-height: 1.3;
}

.ps-hub__intro {
  position: absolute;
  z-index: 6;
  left: 12px;
  right: 12px;
  bottom: 12px;
  max-width: 720px;
  padding: 8px;
  pointer-events: none;
}
.ps-hub__intro :deep(.ps-raccoon) {
  pointer-events: auto;
}
.ps-hub__intro :deep(.ps-raccoon__btn--ghost) {
  color: #eeeee8;
}

@media (max-width: 720px) {
  .ps-hub__pin {
    width: 28px;
    height: 38px;
  }
  .ps-hub__intro {
    left: 8px;
    right: 8px;
    bottom: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ps-hub__pin.is-current .ps-hub__flag,
  .ps-hub__pin.is-pulse .ps-hub__flag,
  .ps-hub__pin:hover .ps-hub__flag,
  .ps-hub__pin:focus-visible .ps-hub__flag {
    animation: none;
  }
}
</style>
