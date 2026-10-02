<template>
  <div class="ps-hub">
    <div ref="stageEl" class="ps-hub__stage">
      <div class="ps-hub__map" :style="mapStyle">
        <img
          class="ps-hub__track"
          :src="TRACK_IMG_SRC"
          alt="Трасса Pit Stop"
          width="1280"
          height="720"
          draggable="false"
        />
        <PitStopHubDrive :color="color" :best-ms="myBestMs" @lap="onLap" />
      </div>
    </div>

    <aside class="ps-hub__side">
      <section class="ps-garage" aria-labelledby="ps-garage-title">
        <h2 id="ps-garage-title" class="ps-garage__title">Гараж</h2>
        <div class="ps-garage__cars" role="radiogroup" aria-label="Цвет болида">
          <button
            v-for="c in CAR_COLORS"
            :key="c.id"
            type="button"
            role="radio"
            class="ps-garage__car"
            :class="{ 'is-on': color === c.id }"
            :aria-checked="color === c.id"
            :title="c.label"
            :style="{ '--swatch': c.swatch }"
            @click="pickColor(c.id)"
          >
            <img :src="carSrc(c.id)" alt="" draggable="false" />
          </button>
        </div>
      </section>

      <section class="ps-board" aria-labelledby="ps-board-title">
        <header class="ps-board__head">
          <div class="ps-board__checker" aria-hidden="true" />
          <h2 id="ps-board-title" class="ps-board__title">Тайминг</h2>
          <p class="ps-board__sub">Лучший круг · {{ board.total }} {{ pilotsWord(board.total) }}</p>
        </header>

        <ol v-if="board.top.length" class="ps-board__list">
          <li
            v-for="row in board.top"
            :key="row.userId"
            class="ps-board__row"
            :class="[`is-p${row.rank}`, { 'is-me': row.isMe }]"
          >
            <span class="ps-board__pos">{{ row.rank }}</span>
            <img class="ps-board__car" :src="carSrc(safeColor(row.color))" alt="" />
            <span class="ps-board__who">
              <span class="ps-board__name">{{ row.isMe ? `${shortName(row.name)} · ты` : shortName(row.name) }}</span>
              <span v-if="row.department" class="ps-board__dept">{{ row.department }}</span>
            </span>
            <span class="ps-board__time">
              {{ row.rank === 1 ? formatLapMs(row.bestMs) : `+${gap(row.bestMs)}` }}
            </span>
          </li>
          <template v-if="board.me && board.me.rank > board.top.length">
            <li class="ps-board__gap" aria-hidden="true">···</li>
            <li class="ps-board__row is-me">
              <span class="ps-board__pos">{{ board.me.rank }}</span>
              <img class="ps-board__car" :src="carSrc(safeColor(board.me.color))" alt="" />
              <span class="ps-board__who">
                <span class="ps-board__name">{{ shortName(board.me.name) }} · ты</span>
              </span>
              <span class="ps-board__time">+{{ gap(board.me.bestMs) }}</span>
            </li>
          </template>
        </ol>
        <p v-else class="ps-board__empty">
          Пока пусто. Проедь чистый круг — встанешь на поул.
        </p>

        <p v-if="loadError" class="ps-board__err">{{ loadError }}</p>
      </section>
    </aside>
  </div>
</template>

<script setup lang="ts">
import {
  CAR_COLORS,
  CAR_COLOR_STORAGE_KEY,
  TRACK_IMG_SRC,
  carSrc,
  formatLapMs,
  isCarColorId,
  type CarColorId
} from '~/events/pit-stop-14/trackDrive';

definePageMeta({ layout: 'default' });

type BoardRow = {
  rank: number;
  userId: number;
  name: string;
  department: string;
  bestMs: number;
  color: string;
  laps: number;
  isMe: boolean;
};

const TRACK_AR = 1280 / 720;

const stageEl = ref<HTMLElement | null>(null);
const mapStyle = ref<Record<string, string>>({});
const color = ref<CarColorId>('violet');
const board = ref<{ top: BoardRow[]; me: BoardRow | null; total: number }>({ top: [], me: null, total: 0 });
const loadError = ref('');

const myBestMs = computed(() => board.value.me?.bestMs ?? null);
const leaderMs = computed(() => board.value.top[0]?.bestMs ?? 0);

const safeColor = (c: string): CarColorId => (isCarColorId(c) ? c : 'violet');
const gap = (ms: number) => ((ms - leaderMs.value) / 1000).toFixed(3);

const shortName = (full: string) => {
  const [last, first] = full.trim().split(/\s+/);
  return first ? `${last} ${first[0]}.` : full;
};

const pilotsWord = (n: number) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'пилот';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'пилота';
  return 'пилотов';
};

const pickColor = (id: CarColorId) => {
  color.value = id;
  if (import.meta.client) localStorage.setItem(CAR_COLOR_STORAGE_KEY, id);
};

const loadBoard = async () => {
  try {
    board.value = await $fetch('/api/event/pit-stop/race/leaderboard');
    loadError.value = '';
  } catch {
    loadError.value = 'Тайминг не загрузился';
  }
};

const onLap = async (ms: number) => {
  try {
    await $fetch('/api/event/pit-stop/race/lap', {
      method: 'POST',
      body: { ms, color: color.value }
    });
  } catch {
    loadError.value = 'Круг не сохранился — проверь связь';
    return;
  }
  await loadBoard();
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
  mapStyle.value = { width: `${Math.floor(w)}px`, height: `${Math.floor(h)}px` };
};

let stageRo: ResizeObserver | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  const saved = localStorage.getItem(CAR_COLOR_STORAGE_KEY);
  if (isCarColorId(saved)) color.value = saved;
  void loadBoard();
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void loadBoard();
  }, 30000);
  nextTick(() => {
    fitMap();
    requestAnimationFrame(fitMap);
  });
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    stageRo = new ResizeObserver(() => fitMap());
    stageRo.observe(stageEl.value);
  }
  window.addEventListener('resize', fitMap);
});

onBeforeUnmount(() => {
  stageRo?.disconnect();
  if (pollTimer) clearInterval(pollTimer);
  window.removeEventListener('resize', fitMap);
});
</script>

<style scoped>
.ps-hub {
  --ps-bg: #1d1d1f;
  --ps-lime: #ddf365;
  --ps-violet: #7451f4;
  --ps-side: 300px;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--ps-bg);
  color: #eeeee8;
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--ps-side);
  gap: 12px;
  padding: 12px;
  box-sizing: border-box;
  overflow: hidden;
  overscroll-behavior-y: contain;
  touch-action: manipulation;
}

.ps-hub__stage {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.ps-hub__map {
  position: relative;
  line-height: 0;
  max-width: 100%;
  max-height: 100%;
  border: 2px solid #111;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 4px 4px 0 var(--ps-violet);
}
.ps-hub__track {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  pointer-events: none;
}

.ps-hub__side {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

/* Гараж */
.ps-garage {
  flex: none;
  padding: 10px 12px 12px;
  background: #eeeee8;
  color: #111;
  border: 2px solid #111;
  border-radius: 12px;
  box-shadow: 4px 4px 0 var(--ps-lime);
}
.ps-garage__title {
  margin: 0 0 8px;
  font-family: Unbounded, 'Golos Text', sans-serif;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.ps-garage__cars {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.ps-garage__car {
  position: relative;
  height: 58px;
  padding: 4px 2px;
  border: 2px solid #111;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.ps-garage__car img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.ps-garage__car:hover {
  transform: translateY(-2px);
}
.ps-garage__car.is-on {
  background: var(--ps-lime);
  box-shadow: 2px 2px 0 #111;
  transform: translateY(-2px);
}
.ps-garage__car:focus-visible {
  outline: 2px solid var(--ps-violet);
  outline-offset: 2px;
}

/* Тайминг */
.ps-board {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #111;
  border: 2px solid #111;
  border-radius: 12px;
  box-shadow: 4px 4px 0 var(--ps-violet);
  overflow: hidden;
}
.ps-board__head {
  position: relative;
  padding: 18px 14px 10px;
  background: #1b1b1d;
  border-bottom: 2px solid #2b2b2e;
}
.ps-board__checker {
  position: absolute;
  inset: 0 0 auto;
  height: 10px;
  background: repeating-conic-gradient(#eeeee8 0 25%, #111 0 50%) 0 0 / 10px 10px;
}
.ps-board__title {
  margin: 0;
  font-family: Unbounded, 'Golos Text', sans-serif;
  font-size: 1.05rem;
  font-weight: 900;
  font-style: italic;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #fff;
}
.ps-board__sub {
  margin: 2px 0 0;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(238, 238, 232, 0.55);
}
.ps-board__list {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 6px 0;
  list-style: none;
  overflow-y: auto;
}
.ps-board__row {
  display: grid;
  grid-template-columns: 30px 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 8px;
  border-left: 3px solid transparent;
}
.ps-board__row:nth-child(even) {
  background: rgba(255, 255, 255, 0.03);
}
.ps-board__row.is-me {
  border-left-color: var(--ps-lime);
  background: rgba(116, 81, 244, 0.28);
}
.ps-board__pos {
  display: grid;
  place-items: center;
  height: 24px;
  border-radius: 5px;
  background: #2b2b2e;
  font-family: Unbounded, 'Golos Text', sans-serif;
  font-size: 0.72rem;
  font-weight: 900;
  font-style: italic;
  color: #eeeee8;
}
.ps-board__row.is-p1 .ps-board__pos {
  background: var(--ps-lime);
  color: #111;
}
.ps-board__row.is-p2 .ps-board__pos {
  background: #eeeee8;
  color: #111;
}
.ps-board__row.is-p3 .ps-board__pos {
  background: var(--ps-violet);
  color: #fff;
}
.ps-board__car {
  width: 18px;
  height: 26px;
  object-fit: contain;
  transform: rotate(90deg);
}
.ps-board__who {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.ps-board__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
  font-weight: 700;
  color: #fff;
}
.ps-board__dept {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.62rem;
  color: rgba(238, 238, 232, 0.5);
}
.ps-board__time {
  font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 0.78rem;
  font-weight: 700;
  color: rgba(238, 238, 232, 0.82);
}
.ps-board__row.is-p1 .ps-board__time {
  color: var(--ps-lime);
}
.ps-board__gap {
  padding: 0 12px;
  text-align: center;
  color: rgba(238, 238, 232, 0.35);
  letter-spacing: 0.3em;
}
.ps-board__empty {
  margin: 0;
  padding: 18px 14px;
  font-size: 0.82rem;
  line-height: 1.45;
  color: rgba(238, 238, 232, 0.7);
}
.ps-board__err {
  margin: 0;
  padding: 8px 12px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #111;
  background: #ff6b5b;
}

@media (max-width: 960px) {
  .ps-hub {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    overflow-y: auto;
    padding: 8px;
  }
  .ps-hub__stage {
    height: min(56.25vw, 70dvh);
  }
  .ps-hub__side {
    overflow: visible;
    padding-bottom: 150px;
  }
  .ps-board {
    flex: none;
  }
  .ps-board__list {
    overflow: visible;
  }
}
</style>
