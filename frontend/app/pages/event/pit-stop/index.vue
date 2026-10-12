<template>
  <div class="ps-hub" :class="{ 'ps-hub--results': showResultsPage }">
    <div ref="stageEl" class="ps-hub__stage">
      <div class="ps-hub__map" :style="mapStyle">
        <PitStopWinnersPodium v-if="showResultsPage" :winners="podiumWinners" />
        <template v-else>
          <img
            class="ps-hub__track"
            :src="TRACK_IMG_SRC"
            alt="Трасса Pit Stop"
            width="1280"
            height="720"
            draggable="false"
          />
          <PitStopHubDrive
            v-if="!eventClosed"
            :color="color"
            :best-ms="myBestMs"
            :paused="showIntro"
            @lap="onLap"
            @finish="onFinish"
          />
          <div v-else class="ps-hub__closed" role="status">
            <p class="ps-hub__closed-title">Финиш ивента</p>
            <p class="ps-hub__closed-text">Заезды закрыты 10 октября в 03:00 МСК. Итоги — в рейтинге справа.</p>
          </div>
          <PitStopFinishParty ref="partyRef" />
        </template>
      </div>
    </div>

    <aside class="ps-hub__side">
      <section v-if="!showResultsPage && !eventClosed" class="ps-garage" aria-labelledby="ps-garage-title">
        <div class="ps-garage__head">
          <h2 id="ps-garage-title" class="ps-garage__title">Гараж</h2>
          <button type="button" class="ps-garage__help" @click="openIntro">Енот</button>
        </div>
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
          <h2 id="ps-board-title" class="ps-board__title">Рейтинг</h2>
          <p v-if="showResultsPage || eventClosed" class="ps-board__sched">Финальный срез · 10.10 03:00 МСК</p>
        </header>

        <p v-if="!showResultsPage && pendingBest && board.nextAt" class="ps-board__pending">
          Твой рекорд {{ formatLapMs(pendingBest) }} попадёт в таблицу в {{ mskTime(board.nextAt) }}
        </p>

        <div v-if="board.top.length || stickyMe" class="ps-board__body">
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
                <span class="ps-board__name">{{ row.isMe ? `${row.name} · ты` : row.name }}</span>
                <span v-if="row.department" class="ps-board__dept">{{ row.department }}</span>
              </span>
              <span class="ps-board__time">{{ formatLapMs(row.bestMs) }}</span>
            </li>
            <li
              v-for="row in board.rest"
              :key="row.userId"
              class="ps-board__row"
              :class="{ 'is-me': row.isMe }"
            >
              <span class="ps-board__pos">{{ row.rank }}</span>
              <img class="ps-board__car" :src="carSrc(safeColor(row.color))" alt="" />
              <span class="ps-board__who">
                <span class="ps-board__name">{{ row.isMe ? `${row.name} · ты` : row.name }}</span>
                <span v-if="row.department" class="ps-board__dept">{{ row.department }}</span>
              </span>
              <span class="ps-board__time">{{ formatLapMs(row.bestMs) }}</span>
            </li>
          </ol>
          <div v-if="stickyMe" class="ps-board__me" aria-label="Твоё место">
            <span class="ps-board__pos">{{ stickyMe.rank ?? '—' }}</span>
            <img
              v-if="stickyMe.color"
              class="ps-board__car"
              :src="carSrc(safeColor(stickyMe.color))"
              alt=""
            />
            <span class="ps-board__who">
              <span class="ps-board__name">ты</span>
            </span>
            <span class="ps-board__time">{{ formatLapMs(stickyMe.bestMs) }}</span>
          </div>
        </div>
        <p v-else class="ps-board__empty">
          {{ eventClosed ? 'Никто не успел записать круг.' : 'Пока пусто. Проедь чистый круг — встанешь на поул.' }}
        </p>

        <p v-if="loadError" class="ps-board__err">{{ loadError }}</p>
      </section>
    </aside>

    <div
      v-if="showIntro && !showResultsPage"
      class="ps-hub__intro"
      role="dialog"
      aria-modal="true"
      aria-label="Енот объясняет правила"
    >
      <div class="ps-hub__intro-box">
        <PitStopRaccoonGuide
          size="hub"
          :line="introStepData.line"
          :art-src="introStepData.art"
          :show-nav="true"
          :can-skip="introStep < RACCOON_RACE_INTRO.length - 1"
          :next-label="introStep >= RACCOON_RACE_INTRO.length - 1 ? 'Поехали!' : 'Дальше'"
          @next="onIntroNext"
          @skip="dismissIntro"
        />
        <p class="ps-hub__intro-step">{{ introStep + 1 }} / {{ RACCOON_RACE_INTRO.length }}</p>
      </div>
    </div>
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
import { RACCOON_RACE_INTRO, RACCOON_RACE_INTRO_STORAGE_KEY } from '~/events/pit-stop-14/raccoonLines';
import { isPitStopGameStopped, isPitStopResultsPageVisible } from '~/events/pit-stop-14/timeline';
import {
  RACE_TOKEN_STORAGE_KEY,
  type LapTelemetry
} from '~/events/pit-stop-14/raceTelemetry';

definePageMeta({ layout: 'default' });

type PodiumWinner = { userId: number; rank: number; name: string; bestMs: number };

type BoardRow = {
  rank: number;
  userId: number;
  name: string;
  department: string;
  bestMs: number;
  color: string;
  isMe: boolean;
};

type Board = {
  top: BoardRow[];
  rest: BoardRow[];
  me: BoardRow | null;
  total: number;
  myLiveBestMs: number | null;
  publishedAt: string;
  nextAt: string | null;
  closed: boolean;
};

const { user, authReady } = useAuth();
const { isAdmin } = usePlatformContext();
const { hydrate: hydrateAvatars } = useAvatars();
const {
  winners: finalizedWinners,
  hydrate: hydratePitStopWinners
} = usePitStopWinners();
const partyRef = ref<{ play: (name: string) => void } | null>(null);
const showResultsPage = computed(() => isPitStopResultsPageVisible());

/** Только UI-режим «Администратор» → статистика; как сотрудник — играет. */
watch(
  [authReady, isAdmin],
  () => {
    if (authReady.value && isAdmin.value) {
      void navigateTo('/admin/quest-dashboard', { replace: true });
    }
  },
  { immediate: true }
);

const showIntro = ref(false);
const introStep = ref(0);
const introStepData = computed(() => RACCOON_RACE_INTRO[introStep.value] ?? RACCOON_RACE_INTRO[0]!);

const openIntro = () => {
  for (const s of RACCOON_RACE_INTRO) new Image().src = s.art;
  introStep.value = 0;
  showIntro.value = true;
};

const dismissIntro = () => {
  showIntro.value = false;
  localStorage.setItem(RACCOON_RACE_INTRO_STORAGE_KEY, '1');
};

const onIntroNext = () => {
  if (introStep.value >= RACCOON_RACE_INTRO.length - 1) dismissIntro();
  else introStep.value += 1;
};

/** «Фамилия Имя» → имя; одно слово — как есть. */
const firstName = (full: string | undefined) => {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  return parts[1] ?? parts[0] ?? 'Пилот';
};

const onFinish = (payload: { ms: number; improved: boolean }) => {
  if (!payload.improved) return;
  partyRef.value?.play(firstName(user.value?.name));
};

const mskTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });

const TRACK_AR = 1280 / 720;

const stageEl = ref<HTMLElement | null>(null);
const mapStyle = ref<Record<string, string>>({});
const color = ref<CarColorId>('violet');
const board = ref<Board>({
  top: [],
  rest: [],
  me: null,
  total: 0,
  myLiveBestMs: null,
  publishedAt: '',
  nextAt: null,
  closed: false
});
const loadError = ref('');

const eventClosed = computed(() => board.value.closed || isPitStopGameStopped());
/** Топ‑3 для подиума: финализация API, иначе live из рейтинга (превью стейджа). */
const podiumWinners = computed<PodiumWinner[]>(() => {
  if (finalizedWinners.value.length) {
    return finalizedWinners.value.map((w) => ({
      userId: w.userId,
      rank: w.rank,
      name: w.name,
      bestMs: w.bestMs
    }));
  }
  return board.value.top
    .filter((r) => r.rank >= 1 && r.rank <= 3)
    .map((r) => ({ userId: r.userId, rank: r.rank, name: r.name, bestMs: r.bestMs }));
});
const myBestMs = computed(() => board.value.myLiveBestMs);
const pendingBest = computed(() => {
  if (eventClosed.value) return null;
  const live = board.value.myLiveBestMs;
  if (live == null) return null;
  const shown = board.value.me?.bestMs;
  return shown == null || live < shown ? live : null;
});

/** Закреп снизу: место в таблице или live-время до публикации. */
const stickyMe = computed(() => {
  if (board.value.me) return board.value.me;
  const live = board.value.myLiveBestMs;
  if (live == null) return null;
  return {
    rank: null as number | null,
    bestMs: live,
    color: color.value
  };
});

const safeColor = (c: string): CarColorId => (isCarColorId(c) ? c : 'violet');

const pickColor = (id: CarColorId) => {
  color.value = id;
  if (import.meta.client) localStorage.setItem(CAR_COLOR_STORAGE_KEY, id);
};

const loadBoard = async () => {
  try {
    const data = await $fetch<Board & { closesAt?: string }>('/api/event/pit-stop/race/leaderboard');
    board.value = {
      top: data.top ?? [],
      rest: data.rest ?? [],
      me: data.me,
      total: data.total,
      myLiveBestMs: data.myLiveBestMs,
      publishedAt: data.publishedAt,
      nextAt: data.nextAt,
      closed: Boolean(data.closed)
    };
    loadError.value = '';
  } catch {
    loadError.value = 'Рейтинг не загрузился';
  }
};

const ensureRaceToken = async (): Promise<string | null> => {
  if (!import.meta.client) return null;
  const cached = sessionStorage.getItem(RACE_TOKEN_STORAGE_KEY);
  if (cached) return cached;
  try {
    const res = await $fetch<{ raceToken?: string }>('/api/event/pit-stop/race/visit', {
      method: 'POST',
      body: {}
    });
    if (res.raceToken) {
      sessionStorage.setItem(RACE_TOKEN_STORAGE_KEY, res.raceToken);
      return res.raceToken;
    }
  } catch {
    /* ignore */
  }
  return null;
};

const onLap = async (ms: number, telemetry: LapTelemetry) => {
  if (eventClosed.value) return;
  try {
    let raceToken = import.meta.client ? sessionStorage.getItem(RACE_TOKEN_STORAGE_KEY) : null;
    if (!raceToken) raceToken = await ensureRaceToken();
    if (!raceToken) {
      loadError.value = 'Круг не сохранился — обнови страницу';
      return;
    }
    const res = await $fetch<{ bestMs: number }>('/api/event/pit-stop/race/lap', {
      method: 'POST',
      body: { ms, color: color.value, raceToken, telemetry }
    });
    board.value.myLiveBestMs = res.bestMs;
  } catch (e: unknown) {
    const err = e as { statusCode?: number; statusMessage?: string; data?: { statusMessage?: string } };
    if (err.statusCode === 403) {
      const msg = `${err.statusMessage || ''} ${err.data?.statusMessage || ''}`.toLowerCase();
      if (msg.includes('заверш') || isPitStopGameStopped()) {
        board.value.closed = true;
        loadError.value = 'Ивент завершён';
        return;
      }
      if (import.meta.client) sessionStorage.removeItem(RACE_TOKEN_STORAGE_KEY);
      const retryToken = await ensureRaceToken();
      if (retryToken) {
        try {
          const res = await $fetch<{ bestMs: number }>('/api/event/pit-stop/race/lap', {
            method: 'POST',
            body: { ms, color: color.value, raceToken: retryToken, telemetry }
          });
          board.value.myLiveBestMs = res.bestMs;
          return;
        } catch {
          /* fall through */
        }
      }
    }
    loadError.value = 'Круг не сохранился — проверь связь';
  }
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
  if (isAdmin.value) return;
  void hydrateAvatars();
  void hydratePitStopWinners();
  void loadBoard();
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void loadBoard();
  }, 30000);

  if (!showResultsPage.value) {
    const saved = localStorage.getItem(CAR_COLOR_STORAGE_KEY);
    if (isCarColorId(saved)) color.value = saved;
    if (!localStorage.getItem(RACCOON_RACE_INTRO_STORAGE_KEY)) openIntro();
    void $fetch<{ raceToken?: string }>('/api/event/pit-stop/race/visit', { method: 'POST', body: {} })
      .then((res) => {
        if (res.raceToken) sessionStorage.setItem(RACE_TOKEN_STORAGE_KEY, res.raceToken);
      })
      .catch(() => {});
  }

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
.ps-hub__closed {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-content: center;
  gap: 8px;
  padding: 24px;
  background: rgba(17, 17, 17, 0.72);
  text-align: center;
}
.ps-hub__closed-title {
  margin: 0;
  font-family: Unbounded, 'Golos Text', sans-serif;
  font-size: clamp(1.1rem, 3vw, 1.6rem);
  font-weight: 900;
  font-style: italic;
  color: #ddf365;
}
.ps-hub__closed-text {
  margin: 0;
  max-width: 28rem;
  font-size: 0.9rem;
  line-height: 1.45;
  color: #eeeee8;
}

.ps-hub__side {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}
.ps-hub--results .ps-board {
  flex: 1 1 auto;
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
.ps-garage__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.ps-garage__help {
  padding: 3px 10px;
  border: 2px solid #111;
  border-radius: 999px;
  background: var(--ps-violet);
  color: #fff;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 2px 2px 0 #111;
}
.ps-garage__help:active {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 #111;
}
.ps-garage__title {
  margin: 0;
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
.ps-board__sched {
  margin: 4px 0 0;
  font-size: 0.62rem;
  color: rgba(238, 238, 232, 0.45);
}
.ps-board__pending {
  margin: 0;
  padding: 7px 12px;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.3;
  color: #111;
  background: var(--ps-lime);
}
.ps-board__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
.ps-board__me {
  flex: none;
  display: grid;
  grid-template-columns: 30px 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 10px 8px;
  border-top: 2px solid #2b2b2e;
  background: #1b1b1d;
  box-shadow: 0 -6px 16px rgba(0, 0, 0, 0.35);
}
.ps-board__me .ps-board__pos {
  background: var(--ps-lime);
  color: #111;
}
.ps-board__me .ps-board__name {
  color: var(--ps-lime);
}
.ps-board__me .ps-board__time {
  color: #fff;
  font-size: 0.88rem;
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

.ps-hub__intro {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: end center;
  padding: 16px;
  background: rgba(17, 17, 17, 0.72);
}
.ps-hub__intro-box {
  position: relative;
  width: min(920px, 100%);
}
.ps-hub__intro-box :deep(.ps-raccoon--hub .ps-raccoon__art) {
  width: clamp(180px, 30vmin, 320px);
  max-height: clamp(220px, 52vmin, 440px);
}
.ps-hub__intro-box :deep(.ps-raccoon__bubble) {
  font-size: clamp(0.84rem, 1.6vw, 1rem);
  line-height: 1.5;
}
.ps-hub__intro-step {
  position: absolute;
  right: 4px;
  top: -22px;
  margin: 0;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: rgba(238, 238, 232, 0.6);
}

@media (max-width: 960px) {
  .ps-hub__intro {
    position: fixed;
    overflow-y: auto;
  }
  .ps-hub {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
    touch-action: pan-y pinch-zoom;
    padding: 8px;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }
  .ps-hub__stage {
    height: min(56.25vw, 52dvh);
    flex: none;
  }
  .ps-hub__side {
    overflow: visible;
    /* стик + нижний док */
    padding-bottom: calc(160px + var(--mobile-nav-clearance, 88px));
  }
  .ps-garage__title {
    font-size: 1rem;
  }
  .ps-garage__help {
    font-size: 0.875rem;
    padding: 6px 12px;
  }
  .ps-garage__car {
    height: 64px;
  }
  .ps-board {
    flex: none;
  }
  .ps-board__list {
    overflow: visible;
  }
  .ps-board__title {
    font-size: 1.15rem;
  }
  .ps-board__sched {
    font-size: 0.8rem;
  }
  .ps-board__pending {
    font-size: 0.875rem;
    padding: 10px 12px;
  }
  .ps-board__row {
    padding: 10px 12px 10px 8px;
    gap: 10px;
  }
  .ps-board__pos {
    height: 28px;
    font-size: 0.85rem;
  }
  .ps-board__name {
    font-size: 1rem;
  }
  .ps-board__dept {
    font-size: 0.8rem;
  }
  .ps-board__time {
    font-size: 0.95rem;
  }
  .ps-board__me .ps-board__time {
    font-size: 1rem;
  }
  .ps-board__empty {
    font-size: 1rem;
  }
  .ps-board__err {
    font-size: 0.875rem;
  }
  .ps-hub__intro-box :deep(.ps-raccoon__bubble) {
    font-size: 1rem;
  }
}
</style>
