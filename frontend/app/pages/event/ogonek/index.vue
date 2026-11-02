<template>
  <div class="og-page">
    <p v-if="pending && !state" class="og-page__loading">Разворачиваем ковёр...</p>
    <p v-else-if="loadError" class="og-page__error" role="alert">{{ loadError }}</p>

    <template v-else-if="state">
      <!--
        Полный экран — свой слой через Teleport в body, а не Fullscreen API:
        так ковёр выходит из-под масштаба платформы и координаты курсора
        совпадают с отрисовкой (грабля уже ловилась на «Ноктюрне»).
      -->
      <Teleport to="body" :disabled="!fullscreen">
        <div :class="fullscreen ? 'og-fullscreen' : 'og-inline'">
          <div class="og-shell">
            <header class="og-head">
              <div class="og-head__text">
                <h1 class="og-head__title">Огонёк 2027</h1>
                <p class="og-head__lead">{{ state.micro.intro }}</p>
              </div>
              <div class="og-head__stats">
                <span class="og-stat">
                  <b>{{ countdown }}</b>
                  <i>до Огонька</i>
                </span>
                <span class="og-stat">
                  <b>{{ state.player.opened.length }} / 19</b>
                  <i>окон открыто</i>
                </span>
                <span class="og-stat og-stat--rank">
                  <b>{{ state.player.rank }}</b>
                  <i>{{ state.player.department || 'ваше звание' }}</i>
                </span>
                <span v-if="state.todayId" class="og-stat">
                  <b>{{ state.openedToday }}</b>
                  <i>уже открыли сегодняшнее</i>
                </span>
                <button type="button" class="og-head__full" @click="toggleFullscreen">
                  {{ fullscreen ? 'Свернуть' : 'Во весь экран' }}
                </button>
              </div>
            </header>

            <p v-if="state.debugAllOpen" class="og-debug">
              Отладка: все 19 окон открыты принудительно. В декабре окна открывает
              календарь — флаг снимается переменной <code>OGONEK_DEBUG_ALL_OPEN=0</code>.
            </p>

            <div class="og-layout">
              <!-- Ковёр: бордюр по краю, медальоны в узоре -->
              <div class="og-carpet" :style="carpetStyle">
                <div class="og-carpet__grid">
                  <OgonekMedallion
                    v-for="day in state.days"
                    :key="day.id"
                    :day="day"
                    :size="fullscreen ? 148 : 126"
                    @open="onMedallionClick"
                  />
                </div>
              </div>

              <div class="og-side">
                <OgonekFeed
                  :items="state.feed"
                  :title="state.micro.feedTitle"
                  :empty="state.micro.feedEmpty"
                  :now-ms="nowMs"
                />
                <div class="og-side__links">
                  <NuxtLink class="og-link" to="/event/ogonek/tree">
                    Ёлка желаний · {{ state.treeCount }} игрушек →
                  </NuxtLink>
                  <p class="og-side__flakes">Снежинок в метели: {{ state.snowflakeCount }}</p>
                </div>
                <ol class="og-ranks">
                  <li v-for="r in state.ranks" :key="r.title" :class="{ 'is-current': r.title === state.player.rank }">
                    <span>{{ r.title }}</span>
                    <i>от {{ r.from }}</i>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Модалка окна -->
      <Teleport to="body">
        <div v-if="activeDay" class="og-modal" @click.self="closeModal">
          <div class="og-modal__inner" role="dialog" aria-modal="true">
            <button type="button" class="og-modal__x" aria-label="Закрыть" @click="closeModal">×</button>
            <OgonekWindowContent
              ref="contentRef"
              :key="activeDay.id"
              :day="activeDay"
              :player="state.player"
              :micro="state.micro"
              :awaiting-label="state.awaitingLabel"
              :toy-size="state.toySize"
              :snowflake-size="state.snowflakeSize"
              :colleagues="colleagues"
              :recipes="state.recipes"
              :thanks="state.thanks"
              :tree-count="state.treeCount"
              :snowflake-count="state.snowflakeCount"
              :busy="busy"
              @submit="onSubmit"
            />
          </div>
        </div>
      </Teleport>

      <!-- Окно нельзя открыть: честно говорим почему -->
      <Teleport to="body">
        <div v-if="blockedNote" class="og-toast" role="status">{{ blockedNote }}</div>
      </Teleport>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Экран адвента «Огонёк 2027»: ковёр с девятнадцатью медальонами, живая
 * лента и звания.
 *
 * Что открыто и что лежит внутри, решает сервер (server/utils/ogonekGate.ts).
 * Страница не считает даты сама — иначе проверка расползётся по компонентам
 * и однажды разойдётся с сервером.
 */
import { OGONEK_DECOR } from '~/events/ogonek/sprites';
import { ogonekSpriteUrl } from '~/utils/ogonekRender';
import { ogonekCountdownParts } from '~/events/ogonek/timeline';
import type { OgonekDayView, OgonekFeedItem, OgonekRank } from '~/events/ogonek/types';

type PlayerView = {
  userId: number;
  name: string;
  department: string;
  opened: number[];
  rank: string;
  plugged: boolean;
  hat: boolean;
  song: string;
  skating: boolean;
  dresscode: string;
  toy: { id: string; pixels: string[]; wish: string; x: number; y: number } | null;
  snowflake: { id: string; pixels: string[] } | null;
  letter: { sealedAt: string; deliverAt: string } | null;
  recipeId: string;
  recipeVote: string;
  thanksSent: number;
};

type AdventState = {
  serverNow: string;
  partyAt: string;
  letterDeliveryAt: string;
  debugAllOpen: boolean;
  demo: boolean;
  micro: Record<string, string>;
  awaitingLabel: string;
  ranks: OgonekRank[];
  toySize: number;
  snowflakeSize: number;
  todayId: number | null;
  openedToday: number;
  headcount: number;
  days: OgonekDayView[];
  feed: OgonekFeedItem[];
  recipes: {
    id: string; name: string; department: string; title: string; text: string;
    votes: number; mine: boolean; myVote: boolean;
  }[];
  thanks: { id: string; text: string; createdAt: string }[];
  treeCount: number;
  snowflakeCount: number;
  player: PlayerView;
};

const FULLSCREEN_KEY = 'vbi-ogonek-fullscreen';

const state = ref<AdventState | null>(null);
const pending = ref(true);
const loadError = ref('');
const busy = ref(false);
const activeId = ref<number | null>(null);
const blockedNote = ref('');
const fullscreen = ref(false);
const contentRef = ref<{ setError: (m: string) => void } | null>(null);

const { employees, hydrate } = useEmployees();
const decor = useOgonekDecor();

const activeDay = computed(
  () => state.value?.days.find((d) => d.id === activeId.value && d.opened) ?? null
);

/** Список коллег для открытки. Себя в нём быть не должно. */
const colleagues = computed(() =>
  employees.value
    .filter((e) => e.platform_user_id !== state.value?.player.userId)
    .map((e) => ({ id: e.id, name: e.name, department: e.department }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
);

const carpetStyle = computed(() => {
  const straight = ogonekSpriteUrl(OGONEK_DECOR.borderStraight);
  return straight ? { '--og-border': `url(${straight})` } : {};
});

/* ------------------------------------------------------------------ часы */

const clockSkew = ref(0);
const nowMs = ref(Date.now());
let tick: ReturnType<typeof setInterval> | null = null;

const countdown = computed(() => {
  if (!state.value) return '';
  const left = Date.parse(state.value.partyAt) - (nowMs.value + clockSkew.value);
  if (left <= 0) return state.value.micro.partyNow ?? 'Сегодня Огонёк';
  const { days, hhmm } = ogonekCountdownParts(left);
  return `${days} дн ${hhmm}`;
});

/* ----------------------------------------------------------------- данные */

async function load() {
  try {
    state.value = await $fetch<AdventState>('/api/event/ogonek/state');
    clockSkew.value = Date.parse(state.value.serverNow) - Date.now();
    loadError.value = '';
    decor.setPlugged(state.value.player.plugged);
    decor.setHat(state.value.player.hat);
  } catch (err) {
    loadError.value = 'Не удалось открыть адвент. Обновите страницу.';
    console.warn('[ogonek] state load failed', err);
  } finally {
    pending.value = false;
  }
}

async function onMedallionClick(id: number) {
  const day = state.value?.days.find((d) => d.id === id);
  if (!day) return;
  if (day.opened) {
    activeId.value = id;
    return;
  }
  if (!day.openable) {
    showBlocked(day);
    return;
  }
  busy.value = true;
  try {
    const res = await $fetch<{ days: OgonekDayView[]; rank: string; opened: number[] }>(
      '/api/event/ogonek/open',
      { method: 'POST', body: { dayId: id } }
    );
    if (state.value) {
      state.value.days = res.days;
      state.value.player.opened = res.opened;
      state.value.player.rank = res.rank;
    }
    // Небольшая пауза: медальон должен успеть перевернуться до модалки.
    setTimeout(() => { activeId.value = id; }, 480);
    void refreshFeed();
  } catch (err) {
    showBlocked(day, errText(err));
  } finally {
    busy.value = false;
  }
}

function showBlocked(day: OgonekDayView, custom?: string) {
  const micro = state.value?.micro ?? {};
  if (custom) blockedNote.value = custom;
  else if (day.blockedBy) {
    blockedNote.value = (micro.blocked ?? 'Сначала окно {N}').replace('{N}', String(day.blockedBy));
  } else {
    blockedNote.value = (micro.locked ?? 'Откроется {date}').replace(
      '{date}',
      new Date(day.opensAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    );
  }
  setTimeout(() => { blockedNote.value = ''; }, 3600);
}

function errText(err: unknown): string {
  const e = err as { statusMessage?: string; data?: { statusMessage?: string } };
  return e?.data?.statusMessage || e?.statusMessage || 'Не получилось. Попробуйте ещё раз.';
}

async function onSubmit(kind: string, payload: Record<string, unknown>) {
  busy.value = true;
  try {
    await $fetch('/api/event/ogonek/submit', { method: 'POST', body: { kind, ...payload } });
    if (kind === 'plug') decor.setPlugged(Boolean(payload.on));
    if (kind === 'hat') decor.setHat(Boolean(payload.on));
    await load();
  } catch (err) {
    contentRef.value?.setError(errText(err));
  } finally {
    busy.value = false;
  }
}

async function refreshFeed() {
  try {
    const res = await $fetch<{ feed: OgonekFeedItem[] }>('/api/event/ogonek/feed');
    if (state.value) state.value.feed = res.feed;
  } catch {
    /* лента не критична — молча пропускаем */
  }
}

function closeModal() {
  activeId.value = null;
}

/* ------------------------------------------------------------ полный экран */

function toggleFullscreen() {
  fullscreen.value = !fullscreen.value;
  try {
    localStorage.setItem(FULLSCREEN_KEY, fullscreen.value ? '1' : '0');
  } catch {
    /* приватный режим — режим просто не запомнится */
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  if (activeId.value !== null) closeModal();
  else if (fullscreen.value) toggleFullscreen();
}

let feedTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  try {
    fullscreen.value = localStorage.getItem(FULLSCREEN_KEY) === '1';
  } catch {
    /* не страшно */
  }
  window.addEventListener('keydown', onKey);
  tick = setInterval(() => { nowMs.value = Date.now(); }, 1000);
  feedTimer = setInterval(refreshFeed, 30000);
  void hydrate();
  await load();
  void decor.refresh();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  if (tick) clearInterval(tick);
  if (feedTimer) clearInterval(feedTimer);
});
</script>

<style scoped>
.og-page { min-height: 60vh; }

.og-page__loading,
.og-page__error { color: #e8d7b4; }

.og-inline { display: block; }

.og-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 70;
  overflow: auto;
  background: #2a2320;
  padding: 18px;
}

.og-shell {
  background:
    radial-gradient(circle at 20% 0%, rgba(217, 154, 43, 0.12), transparent 55%),
    #7d1f28;
  border: 3px solid #1a1412;
  border-radius: 12px;
  padding: 20px;
  color: #e8d7b4;
}

.og-head {
  display: flex;
  gap: 20px;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: flex-start;
  margin-bottom: 16px;
}

.og-head__title {
  margin: 0;
  font-family: 'Unbounded', system-ui, sans-serif;
  font-size: 30px;
  color: #f5efe3;
  letter-spacing: 0.01em;
}

.og-head__lead { margin: 6px 0 0; max-width: 46ch; line-height: 1.5; opacity: 0.88; }

.og-head__stats { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

.og-stat {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  background: rgba(26, 20, 18, 0.45);
  border: 1px solid rgba(232, 215, 180, 0.22);
  border-radius: 8px;
  min-width: 96px;
}

.og-stat b { font-size: 16px; color: #f5efe3; font-weight: 700; }
.og-stat i { font-style: normal; font-size: 11px; opacity: 0.68; }
.og-stat--rank b { color: #d99a2b; }

.og-head__full {
  background: transparent;
  border: 1px solid rgba(232, 215, 180, 0.45);
  color: #e8d7b4;
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
}

.og-head__full:hover { background: rgba(232, 215, 180, 0.12); }

.og-debug {
  margin: 0 0 14px;
  padding: 8px 12px;
  border: 1px dashed rgba(217, 154, 43, 0.6);
  border-radius: 6px;
  font-size: 12px;
  color: #d99a2b;
}

.og-debug code { background: rgba(26, 20, 18, 0.5); padding: 1px 5px; border-radius: 3px; }

.og-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: 18px;
  align-items: start;
}

/* Ковёр: бордюрный тайл повторяется по краю, медальоны — в поле */
.og-carpet {
  position: relative;
  padding: 26px;
  background: #7d1f28;
  border: 3px solid #1a1412;
  border-radius: 6px;
  background-image: var(--og-border), var(--og-border);
  background-repeat: repeat-x, repeat-x;
  background-position: top left, bottom left;
  background-size: 108px auto, 108px auto;
  image-rendering: pixelated;
}

.og-carpet__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 18px 10px;
  justify-items: center;
  /* Сверху и снизу — полоса под бордюрный тайл: медальоны на него не лезут. */
  padding: 106px 6px;
}

.og-side { display: flex; flex-direction: column; gap: 14px; }

.og-side__links {
  background: rgba(26, 20, 18, 0.45);
  border: 1px solid rgba(232, 215, 180, 0.2);
  border-radius: 10px;
  padding: 12px 14px;
}

.og-side__flakes { margin: 8px 0 0; font-size: 13px; opacity: 0.75; }

.og-link { color: #d99a2b; text-decoration: none; font-weight: 600; }
.og-link:hover { text-decoration: underline; }

.og-ranks {
  list-style: none;
  margin: 0;
  padding: 12px 14px;
  background: rgba(26, 20, 18, 0.45);
  border: 1px solid rgba(232, 215, 180, 0.2);
  border-radius: 10px;
  font-size: 13px;
}

.og-ranks li {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  opacity: 0.65;
}

.og-ranks li.is-current {
  opacity: 1;
  color: #d99a2b;
  font-weight: 700;
}

.og-ranks i { font-style: normal; opacity: 0.6; }

/* ------------------------------------------------------------------ модалка */

.og-modal {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(26, 20, 18, 0.78);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 36px 18px;
  overflow-y: auto;
  animation: og-fade 0.22s ease;
}

@keyframes og-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.og-modal__inner {
  position: relative;
  width: min(880px, 100%);
  background:
    linear-gradient(180deg, rgba(31, 65, 54, 0.35), rgba(26, 20, 18, 0)),
    #2a2320;
  border: 3px solid #d99a2b;
  border-radius: 12px;
  padding: 24px 26px;
  animation: og-rise 0.3s cubic-bezier(0.2, 0.9, 0.3, 1);
}

@keyframes og-rise {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to { opacity: 1; transform: none; }
}

.og-modal__x {
  position: absolute;
  top: 10px;
  right: 12px;
  background: none;
  border: 0;
  color: #e8d7b4;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
}

.og-toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 95;
  background: #1a1412;
  border: 2px solid #d99a2b;
  border-radius: 8px;
  color: #e8d7b4;
  padding: 10px 16px;
  font-size: 14px;
  animation: og-rise 0.25s ease;
}

@media (prefers-reduced-motion: reduce) {
  .og-modal,
  .og-modal__inner,
  .og-toast { animation: none; }
}

@media (max-width: 1100px) {
  .og-layout { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 700px) {
  .og-shell { padding: 12px; }
  .og-carpet { padding: 12px; }
  .og-carpet__grid {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 14px 6px;
    padding: 70px 2px;
  }
  .og-head__title { font-size: 24px; }
  .og-modal { padding: 16px 10px; }
  .og-modal__inner { padding: 18px 14px; }
}
</style>
