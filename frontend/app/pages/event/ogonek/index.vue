<template>
  <div class="og-page og-theme">
    <p v-if="pending && !state" class="og-page__state">Достаём календарь...</p>
    <p v-else-if="loadError" class="og-page__state" role="alert">{{ loadError }}</p>

    <template v-else-if="state">
      <!--
        Полный экран — свой слой через Teleport в body, а не Fullscreen API:
        так календарь выходит из-под масштаба платформы и координаты курсора
        совпадают с отрисовкой (грабля уже ловилась на «Ноктюрне»).
      -->
      <Teleport to="body" :disabled="!fullscreen">
        <div
          :class="fullscreen ? 'og-fullscreen og-theme' : 'og-inline'"
          :style="{ '--og-sticky-top': `${fullscreen ? 0 : stickyTop}px` }"
        >
          <div class="og-wrap">
            <header class="og-top">
              <h1 class="og-top__title">ОГОНЁК 2027</h1>
              <div class="og-top__stats">
                <span class="og-score" aria-live="polite">ОГОНЬКИ <span><b>{{ doneCount }}</b>/19</span></span>
                <span class="og-score">ДО ВЕЧЕРА <b>{{ countdown }}</b></span>
                <span class="og-score og-score--rank">{{ state.player.rank }}</span>
              </div>
            </header>

            <OgonekGarlandBar ref="garlandRef" :days="state.days" />

            <main ref="stageRef" class="og-stage">
              <div class="og-stage__head">
                <h2>ДЕКАБРЬ 2026</h2>
                <button type="button" class="og-btn og-btn--ghost" @click="toggleFullscreen">
                  {{ fullscreen ? 'Свернуть' : 'Во весь экран' }}
                </button>
              </div>
              <div class="og-grid">
                <OgonekSheet
                  v-for="day in state.days"
                  :key="day.id"
                  :ref="(c) => setSheet(day.id, c)"
                  :day="day"
                  @open="openDay"
                />
              </div>
            </main>

            <section class="og-below">
              <OgonekFeed
                :items="state.feed"
                :title="state.micro.feedTitle"
                :empty="state.micro.feedEmpty"
                :now-ms="nowMs"
              />
              <div class="og-below__side">
                <NuxtLink class="og-panel og-panel--link" to="/event/ogonek/tree">
                  <span class="og-panel__k">ЁЛКА ЖЕЛАНИЙ</span>
                  <span>{{ state.treeCount }} игрушек · снежинок в метели {{ state.snowflakeCount }}</span>
                </NuxtLink>
                <div v-if="state.todayId" class="og-panel">
                  <span class="og-panel__k">СЕГОДНЯ</span>
                  <span>уже открыли {{ state.openedToday }} человек</span>
                </div>
                <ol class="og-panel og-ranks">
                  <li class="og-panel__k">ЗВАНИЯ</li>
                  <li
                    v-for="r in state.ranks"
                    :key="r.title"
                    :class="{ 'is-current': r.title === state.player.rank }"
                  >
                    <span>{{ r.title }}</span><i>от {{ r.from }}</i>
                  </li>
                </ol>
              </div>
            </section>

            <!-- Панель отладки: только вне боя -->
            <div v-if="state.devTools" class="og-demo">
              <b>ОТЛАДКА</b>
              <label for="og-dev-day">Сегодня
                <select id="og-dev-day" :value="devDayValue" @change="onDevDay">
                  <option value="">все 19 открыты</option>
                  <option v-for="d in state.days" :key="d.id" :value="String(d.id)">
                    {{ Number(d.dateIso.slice(8, 10)) }} декабря · окно {{ d.id }}
                  </option>
                </select>
              </label>
              <button type="button" class="og-btn og-btn--ghost" @click="resetProgress">Сбросить прогресс</button>
              <span class="og-demo__note">{{ devNote }}</span>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Снег над календарём: снежинки участников с подписью при наведении -->
      <Teleport to="body">
        <div class="og-theme">
          <OgonekSnowField :authors="flakeAuthors" />
        </div>
      </Teleport>

      <!-- Раскрытый день: вырастает из листка на всю сцену -->
      <Teleport to="body">
        <section
          v-if="openId !== null && openDayView"
          ref="overlayRef"
          class="og-ov og-theme"
          :class="{ 'is-ready': overlayReady }"
          role="dialog"
          aria-modal="true"
          :aria-label="`${dayNum(openDayView)} декабря`"
          :style="overlayBox"
        >
          <div class="og-ov__in">
            <div class="og-ov__stub" aria-hidden="true" />
            <div class="og-ov__head">
              <div>
                <span class="og-ov__when">{{ dayNum(openDayView) }} ДЕКАБРЯ · {{ openDayView.weekday.toUpperCase() }}</span>
                <span class="og-ov__kind">{{ KIND[openDayView.kind] }}</span>
              </div>
              <button ref="closeRef" type="button" class="og-btn og-btn--ghost" @click="closeDay">← К календарю</button>
            </div>
            <div class="og-ov__body">
              <div class="og-art">
                <span class="og-art__cap">восх. {{ openSun.rise }} · зах. {{ openSun.set }}</span>
                <OgonekSprite :rows="objectOf(openDayView)" width-css="100%" :alt="openDayView.title" />
              </div>
              <div class="og-txt">
                <h3>{{ openDayView.title }}</h3>
                <p v-for="(line, i) in openDayView.lead" :key="i">{{ line }}</p>
                <p v-if="openDayView.produces" class="og-txt__produces">{{ openDayView.produces }}</p>
                <p v-if="openDayView.draft" class="og-txt__draft">{{ state.micro.draftNote }}</p>
                <OgonekWindowContent
                  ref="contentRef"
                  :key="openDayView.id"
                  :day="openDayView"
                  :player="state.player"
                  :micro="state.micro"
                  :awaiting-label="state.awaitingLabel"
                  :toy-size="state.toySize"
                  :colleagues="colleagues"
                  :recipes="state.recipes"
                  :thanks="state.thanks"
                  :tree-count="state.treeCount"
                  :snowflake-count="state.snowflakeCount"
                  :busy="busy"
                  @submit="onSubmit"
                  @fireworks="fireworks"
                />
              </div>
            </div>
          </div>
        </section>
      </Teleport>

      <Teleport to="body">
        <div v-if="toastText" class="og-toast og-theme" role="status">{{ toastText }}</div>
      </Teleport>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Экран адвента «Огонёк 2027»: отрывной календарь на 19 рабочих дней,
 * гирлянда-прогресс, снег из снежинок участников, живая лента и звания.
 *
 * Дизайн — прототип `ogonek-advent-prototype.html` (листки, гирлянда,
 * раскрытие дня, штамп). Содержимое окон — наше, из спеки.
 *
 * Что открыто и что лежит внутри, решает сервер (server/utils/ogonekGate.ts).
 * Страница даты не считает — иначе проверка расползётся по компонентам.
 */
import { OGONEK_OBJECTS } from '~/events/ogonek/sprites';
import { ogonekCountdownParts } from '~/events/ogonek/timeline';
import { ogonekSun } from '~/events/ogonek/sun';
import type { OgonekDayKind, OgonekDayView, OgonekFeedItem, OgonekRank } from '~/events/ogonek/types';

useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=PT+Sans:wght@400;700&family=PT+Sans+Narrow:wght@700&display=swap'
    }
  ]
});

type PlayerView = {
  userId: number;
  name: string;
  department: string;
  opened: number[];
  done: number[];
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
  debugAllOpen: boolean;
  devDay: number | null;
  devTools: boolean;
  micro: Record<string, string>;
  awaitingLabel: string;
  ranks: OgonekRank[];
  toySize: number;
  todayId: number | null;
  openedToday: number;
  days: OgonekDayView[];
  feed: OgonekFeedItem[];
  recipes: {
    id: string; name: string; department: string; title: string; text: string;
    votes: number; mine: boolean; myVote: boolean;
  }[];
  thanks: { id: string; text: string; createdAt: string }[];
  treeCount: number;
  snowflakeCount: number;
  snowflakes?: { name: string; pixels: string[]; mine: boolean }[];
  player: PlayerView;
};

/** Подпись типа окна в шапке раскрытого дня. */
const KIND: Record<OgonekDayKind, string> = {
  song: 'ПЛЕЙЛИСТ', avatar: 'АВАТАР', merch: 'МЕРЧ', plug: 'ДЕКОР', skating: 'КАТОК',
  toy: 'ЁЛКА', numbers: 'ЦИФРЫ', dresscode: 'ДРЕСС-КОД', reels: 'РИЛСЫ', tictactoe: 'ИГРА',
  photoyear: 'ФОТО', snowflake: 'СНЕЖИНКА', thanks: 'ОТКРЫТКА', teamphoto: 'ФОТО',
  minigame: 'МИНИ-ИГРА', letter: 'ПИСЬМО', olivier: 'РЕЦЕПТЫ', program: 'ПРОГРАММА', final: 'ФИНАЛ'
};

const FULLSCREEN_KEY = 'vbi-ogonek-fullscreen';
const DEV_DAY_COOKIE = 'ogonek-dev-day';

const state = ref<AdventState | null>(null);
const pending = ref(true);
const loadError = ref('');
const busy = ref(false);
const fullscreen = ref(false);
const toastText = ref('');

const { employees, hydrate } = useEmployees();
const decor = useOgonekDecor();

const stageRef = ref<HTMLElement | null>(null);
const garlandRef = ref<{ puff: (id: number) => void; isVisible: (id: number) => boolean } | null>(null);
const contentRef = ref<{ setError: (m: string) => void } | null>(null);
const closeRef = ref<HTMLElement | null>(null);
const overlayRef = ref<HTMLElement | null>(null);

type SheetApi = {
  tear: () => Promise<void>;
  shake: () => void;
  pulse: () => void;
  settle: () => void;
  el: HTMLElement | null;
};
const sheets = new Map<number, SheetApi>();
function setSheet(id: number, c: unknown) {
  if (c) sheets.set(id, c as SheetApi);
  else sheets.delete(id);
}

const doneCount = computed(() => state.value?.player.done.length ?? 0);
const dayNum = (d: OgonekDayView) => Number(d.dateIso.slice(8, 10));
const objectOf = (d: OgonekDayView) => OGONEK_OBJECTS[d.object] ?? OGONEK_OBJECTS.ogonek;

/** Коллеги для открытки. Без учётки на платформе открытка не дойдёт. */
const colleagues = computed(() =>
  employees.value
    .filter((e) => e.platform_user_id && e.platform_user_id !== state.value?.player.userId)
    .map((e) => ({ id: e.id, name: e.name, department: e.department }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
);

/** Авторы снежинок для снегопада над календарём. */
const flakeAuthors = computed(() =>
  (state.value?.snowflakes ?? []).map((f) => ({ by: f.name, q: f.pixels, mine: f.mine }))
);

/* ------------------------------------------------------------------ часы */

const clockSkew = ref(0);
const nowMs = ref(Date.now());
let tick: ReturnType<typeof setInterval> | null = null;

const countdown = computed(() => {
  if (!state.value) return '';
  const left = Date.parse(state.value.partyAt) - (nowMs.value + clockSkew.value);
  if (left <= 0) return 'СЕГОДНЯ';
  const { days, hhmm } = ogonekCountdownParts(left);
  return `${days} ДН ${hhmm}`;
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

function toast(msg: string) {
  toastText.value = msg;
  setTimeout(() => { if (toastText.value === msg) toastText.value = ''; }, 2600);
}

function errText(err: unknown): string {
  const e = err as { statusMessage?: string; data?: { statusMessage?: string } };
  return e?.data?.statusMessage || e?.statusMessage || 'Не получилось. Попробуйте ещё раз.';
}

const reduce = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/* ------------------------------------------------------- раскрытие дня */

const openId = ref<number | null>(null);
const overlayReady = ref(false);
const overlayBox = ref<Record<string, string>>({});
/** Огонёк загорелся, пока гирлянда была не видна — «пуф» покажем на возврате. */
let puffOnClose = false;

const openDayView = computed(() => state.value?.days.find((d) => d.id === openId.value) ?? null);
const openSun = computed(() => ogonekSun(openDayView.value?.dateIso ?? '2026-12-01'));

const px = (r: { left: number; top: number; width: number; height: number }) => ({
  left: `${r.left}px`,
  top: `${r.top}px`,
  width: `${r.width}px`,
  height: `${r.height}px`
});

/** Куда раскрывается день: сцена календаря, но целиком в экране. */
function targetRect() {
  const m = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const minTop = (fullscreen.value ? 0 : stickyTop.value) + m;
  const s = stageRef.value?.getBoundingClientRect();
  if (!s) return { left: m, top: minTop, width: vw - 2 * m, height: vh - minTop - m };
  const top = Math.max(s.top, minTop);
  const bottom = Math.min(s.bottom, vh - m);
  const left = Math.max(s.left, m);
  const right = Math.min(s.right, vw - m);
  if (bottom - top < 420) return { left, top: minTop, width: right - left, height: vh - minTop - m };
  return { left, top, width: right - left, height: bottom - top };
}

async function openDay(id: number) {
  if (busy.value || openId.value !== null || !state.value) return;
  const day = state.value.days.find((d) => d.id === id);
  const sheet = sheets.get(id);
  if (!day || !sheet) return;

  if (!day.opened && !day.openable) {
    sheet.shake();
    if (day.blockedBy) toast(`Сначала окно ${day.blockedBy}: пропущенные открываются по очереди`);
    else toast(`Этот листок откроется ${dayNum(day)} декабря`);
    return;
  }

  busy.value = true;
  try {
    if (!day.opened) {
      // Сначала сервер: оторвать листок, который сервер не открыл, нельзя.
      const res = await $fetch<{ days: OgonekDayView[]; rank: string; opened: number[] }>(
        '/api/event/ogonek/open',
        { method: 'POST', body: { dayId: id } }
      );
      await sheet.tear();
      state.value.days = res.days;
      state.value.player.opened = res.opened;
      state.value.player.rank = res.rank;
      await nextTick();
      sheets.get(id)?.settle();
      void refreshFeed();
    }
  } catch (err) {
    sheet.shake();
    toast(errText(err));
    busy.value = false;
    return;
  }

  puffOnClose = false;
  document.body.classList.add('og-locked-scroll');
  const from = sheets.get(id)?.el?.getBoundingClientRect();
  const to = targetRect();
  overlayBox.value = px(to);
  overlayReady.value = false;
  openId.value = id;
  await nextTick();

  const ov = overlayRef.value;
  if (ov && from && !reduce()) {
    await ov.animate(
      [{ ...px(from), borderColor: '#9a2836' }, { ...px(to), borderColor: '#ffcf4a' }],
      { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' }
    ).finished;
  }
  overlayReady.value = true;
  closeRef.value?.focus();
  busy.value = false;
}

async function closeDay() {
  if (openId.value === null || busy.value) return;
  busy.value = true;
  const id = openId.value;
  overlayReady.value = false;
  const ov = overlayRef.value;
  const to = sheets.get(id)?.el?.getBoundingClientRect();
  if (ov && to && !reduce()) {
    await new Promise((r) => setTimeout(r, 160));
    const from = ov.getBoundingClientRect();
    await ov.animate(
      [{ ...px(from) }, { ...px(to), borderColor: '#9a2836' }],
      { duration: 440, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' }
    ).finished;
  }
  openId.value = null;
  document.body.classList.remove('og-locked-scroll');
  await nextTick();
  const sheet = sheets.get(id);
  sheet?.pulse();
  sheet?.el?.focus();
  if (puffOnClose) garlandRef.value?.puff(id);
  puffOnClose = false;
  busy.value = false;
}

/* -------------------------------------------------------------- действия */

async function onSubmit(kind: string, payload: Record<string, unknown>) {
  if (!state.value) return;
  const id = openId.value;
  const wasDone = id !== null && state.value.player.done.includes(id);
  busy.value = true;
  try {
    await $fetch('/api/event/ogonek/submit', { method: 'POST', body: { kind, ...payload } });
    if (kind === 'plug') decor.setPlugged(Boolean(payload.on));
    if (kind === 'hat') decor.setHat(Boolean(payload.on));
    await load();
    if (kind === 'snowflake') {
      void decor.refresh();
      toast('Ваша снежинка уже летит');
    }
    // Огонёк загорелся впервые: «пуф» сейчас, если гирлянда видна, иначе на возврате.
    const nowDone = id !== null && state.value?.player.done.includes(id);
    if (id !== null && nowDone && !wasDone) {
      if (garlandRef.value?.isVisible(id)) garlandRef.value.puff(id);
      else puffOnClose = true;
    }
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

/** Салют в финальном окне. */
function fireworks() {
  const ov = overlayRef.value;
  if (!ov || reduce()) return;
  const COLORS = ['#ffcf4a', '#5aa8ff', '#3fbf68', '#ff7fb0', '#ffffff'];
  const r = ov.getBoundingClientRect();
  for (let k = 0; k < 5; k++) {
    const cx = r.left + r.width * (0.2 + 0.6 * Math.random());
    const cy = r.top + r.height * (0.2 + 0.4 * Math.random());
    for (let i = 0; i < 18; i++) {
      const c = document.createElement('i');
      c.className = 'ogs-crumb';
      c.style.background = COLORS[(i + k) % COLORS.length]!;
      c.style.left = `${cx}px`;
      c.style.top = `${cy}px`;
      document.body.appendChild(c);
      const a = (i / 18) * Math.PI * 2;
      const dist = 50 + Math.random() * 60;
      c.animate(
        [
          { transform: 'translate(0,0)', opacity: 1 },
          { transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist + 30}px)`, opacity: 0 }
        ],
        { duration: 900, delay: k * 180, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'backwards' }
      ).onfinish = () => c.remove();
    }
  }
}

/* ------------------------------------------------------------- отладка */

const devDayValue = computed(() => (state.value?.devDay ? String(state.value.devDay) : ''));
const devNote = computed(() => {
  if (!state.value) return '';
  if (state.value.devDay) return 'Честный календарь выбранного дня: видно закрытые, сегодняшний и пропущенные листки.';
  return 'Все окна открыты принудительно. Выберите день, чтобы увидеть честное расписание.';
});

/**
 * Отладочный день — cookie, который читает сервер (и только вне боя).
 * Гейт при этом остаётся на сервере: клиент лишь говорит, какой сегодня день.
 */
async function onDevDay(e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  document.cookie = v
    ? `${DEV_DAY_COOKIE}=${v}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
    : `${DEV_DAY_COOKIE}=; path=/; max-age=0; samesite=lax`;
  await load();
}

async function resetProgress() {
  try {
    await $fetch('/api/event/ogonek/submit', { method: 'POST', body: { kind: 'devReset' } });
    await load();
    toast('Прогресс сброшен: листки снова целые, огоньки погашены');
  } catch (err) {
    toast(errText(err));
  }
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
  if (openId.value !== null) void closeDay();
  else if (fullscreen.value) toggleFullscreen();
}

function onResize() {
  measureStickyTop();
  if (openId.value !== null && !busy.value) overlayBox.value = px(targetRect());
}

/**
 * Шапка платформы липкая. Гирлянда липнет сразу под ней — иначе при
 * прокрутке она уходит под шапку и огоньков не видно. Берём ту шапку,
 * которая сейчас на экране: на десктопе и на телефоне они разные.
 */
const stickyTop = ref(0);
function measureStickyTop() {
  let bottom = 0;
  for (const el of document.querySelectorAll<HTMLElement>('.topbar, .mob-top')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || !/sticky|fixed/.test(cs.position)) continue;
    bottom = Math.max(bottom, el.getBoundingClientRect().height);
  }
  stickyTop.value = Math.round(bottom);
}

let feedTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  try {
    fullscreen.value = localStorage.getItem(FULLSCREEN_KEY) === '1';
  } catch {
    /* не страшно */
  }
  // Зубчатый край оторванного листка — один раз на страницу.
  const pts = ['0 0', '100% 0'];
  for (let i = 24; i >= 0; i--) pts.push(`${((i / 24) * 100).toFixed(2)}% calc(100% - ${i % 2 ? 0 : 6}px)`);
  document.documentElement.style.setProperty('--og-zig', `polygon(${pts.join(',')})`);

  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  measureStickyTop();
  tick = setInterval(() => { nowMs.value = Date.now(); }, 1000);
  feedTimer = setInterval(refreshFeed, 30000);
  void hydrate();
  await load();
  void decor.refresh();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', onResize);
  document.body.classList.remove('og-locked-scroll');
  if (tick) clearInterval(tick);
  if (feedTimer) clearInterval(feedTimer);
});
</script>

<style scoped>
.og-page {
  min-height: 60vh;
  background: radial-gradient(120% 80% at 50% 0%, #64101d 0%, var(--og-bg) 60%), var(--og-bg);
  padding: 20px clamp(12px, 2vw, 20px) 40px;
  font-size: 16px;
  line-height: 1.5;
}

.og-page__state { color: var(--og-muted); }

.og-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 70;
  overflow: auto;
  background: radial-gradient(120% 80% at 50% 0%, #64101d 0%, var(--og-bg) 60%), var(--og-bg);
  padding: 20px 16px 40px;
}

.og-wrap {
  max-width: 1080px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ——— шапка ——— */
.og-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
}

.og-top__title {
  font-family: var(--og-pixel);
  font-size: clamp(20px, 3.6vw, 30px);
  line-height: 1.3;
  margin: 0;
  color: var(--og-gold);
  text-shadow: 0 0 18px rgba(255, 207, 74, 0.5), 3px 3px 0 #6b2a00;
  letter-spacing: 0.02em;
}

.og-top__stats { display: flex; flex-wrap: wrap; gap: 10px; }

.og-score {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--og-pixel);
  font-size: 11px;
  color: var(--og-gold-soft);
  background: var(--og-bg-2);
  border: 2px solid var(--og-line);
  padding: 10px 12px;
  box-shadow: 4px 4px 0 var(--og-shade);
}

.og-score b { font-size: 14px; color: var(--og-gold); font-weight: 400; }
.og-score--rank { color: var(--og-gold); }

/* ——— сцена ——— */
.og-stage {
  position: relative;
  background: linear-gradient(180deg, var(--og-bg-2), #470b15 75%);
  border: 2px solid var(--og-line);
  box-shadow: 6px 6px 0 var(--og-shade);
  padding: 22px clamp(12px, 2.4vw, 26px) 26px;
}

.og-stage__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.og-stage__head h2 {
  margin: 0;
  font-family: var(--og-pixel);
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--og-snow);
}

.og-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: clamp(10px, 1.6vw, 16px);
}

/* ——— под сценой: лента и звания ——— */
.og-below {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 14px;
  align-items: start;
}

.og-below__side { display: flex; flex-direction: column; gap: 14px; }

.og-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--og-bg-2);
  border: 2px solid var(--og-line);
  box-shadow: 4px 4px 0 var(--og-shade);
  padding: 12px 14px;
  font-size: 15px;
  color: var(--og-muted);
  text-decoration: none;
}

.og-panel--link:hover { border-color: var(--og-gold); }
.og-panel__k { font-family: var(--og-pixel); font-size: 9px; color: var(--og-gold); letter-spacing: 0.04em; }

.og-ranks { list-style: none; margin: 0; }
.og-ranks li:not(.og-panel__k) { display: flex; justify-content: space-between; opacity: 0.7; }
.og-ranks li.is-current { opacity: 1; color: var(--og-gold); font-weight: 700; }
.og-ranks i { font-style: normal; opacity: 0.6; }

/* ——— отладка ——— */
.og-demo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  font-size: 14px;
  color: var(--og-muted);
  border: 2px dashed #8a2531;
  padding: 10px 12px;
}

.og-demo b { font-family: var(--og-pixel); font-size: 9px; color: #ffd9d6; font-weight: 400; }
.og-demo label { display: flex; align-items: center; gap: 8px; }
.og-demo select {
  background: var(--og-bg-2);
  color: var(--og-snow);
  border: 2px solid var(--og-line);
  padding: 4px 6px;
  font: inherit;
}
.og-demo__note { flex-basis: 100%; font-size: 13px; opacity: 0.8; }

/* Кнопки страницы — те же, что в окне */
.og-btn {
  font-family: var(--og-pixel);
  font-size: 10px;
  line-height: 1.4;
  padding: 10px 14px;
  border: 0;
  cursor: pointer;
  background: var(--og-gold);
  color: #3a2600;
  box-shadow: 3px 3px 0 #6b2a00;
}

.og-btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #6b2a00; }
.og-btn--ghost { background: transparent; color: #ffd9d6; box-shadow: none; border: 2px solid var(--og-line); }

/* ——— раскрытый день ——— */
.og-ov {
  position: fixed;
  z-index: 50;
  background: var(--og-bg-2);
  border: 2px solid var(--og-gold);
  box-shadow: 0 0 0 4px var(--og-shade), 0 0 40px rgba(255, 207, 74, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.og-ov__in {
  flex: 1;
  overflow: auto;
  opacity: 0;
  transition: opacity 0.25s ease;
  display: flex;
  flex-direction: column;
}

.og-ov.is-ready .og-ov__in { opacity: 1; }

.og-ov__stub { height: 22px; flex: none; background: var(--og-paper-2); clip-path: var(--og-zig); }

.og-ov__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px clamp(14px, 3vw, 28px);
  border-bottom: 2px solid var(--og-line);
}

.og-ov__when { font-family: var(--og-pixel); font-size: 11px; line-height: 1.6; color: var(--og-gold-soft); }

.og-ov__kind {
  font-family: var(--og-pixel);
  font-size: 8px;
  padding: 5px 7px;
  background: var(--og-bg-3);
  color: #ffd9d6;
  margin-left: 10px;
  vertical-align: 2px;
}

.og-ov__body {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
  gap: clamp(18px, 4vw, 44px);
  align-items: start;
  padding: clamp(18px, 3vw, 34px) clamp(14px, 3vw, 28px) 28px;
}

.og-art {
  position: relative;
  /*
    Ширина явная: спрайт внутри задан в процентах, и без неё карточка
    схлопывалась по содержимому в узкую полоску.
  */
  width: 100%;
  background: var(--og-paper);
  padding: 34px 22px 22px;
  box-shadow: 6px 6px 0 var(--og-shade);
  display: grid;
  place-items: center;
}

.og-art :deep(.og-sprite) { width: 100%; max-width: 200px; }

.og-art__cap {
  position: absolute;
  left: 10px;
  top: 8px;
  font-family: var(--og-narrow);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--og-ink-soft);
  text-transform: uppercase;
}

.og-txt { min-width: 0; display: flex; flex-direction: column; gap: 14px; max-width: 62ch; }

.og-txt h3 {
  margin: 0;
  font-family: var(--og-pixel);
  font-size: clamp(15px, 2.2vw, 20px);
  line-height: 1.5;
  color: var(--og-snow);
  text-wrap: balance;
  font-weight: 400;
}

.og-txt p { margin: 0; color: #f6d9d6; font-size: 17px; }
.og-txt__produces { font-size: 14px !important; color: var(--og-gold-soft) !important; }
.og-txt__draft { font-size: 13px !important; color: var(--og-muted) !important; font-style: italic; opacity: 0.7; }

.og-toast {
  position: fixed;
  left: 50%;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 80;
  font-family: var(--og-pixel);
  font-size: 10px;
  line-height: 1.6;
  background: var(--og-paper);
  color: var(--og-ink);
  padding: 10px 14px;
  box-shadow: 4px 4px 0 var(--og-shade);
  max-width: calc(100% - 32px);
}

@media (max-width: 900px) {
  .og-grid { grid-template-columns: repeat(4, 1fr); }
  .og-below { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 700px) {
  .og-ov__body { grid-template-columns: 1fr; }
  .og-art { max-width: 240px; margin: 0 auto; padding: 30px 16px 16px; }
  .og-art :deep(.og-sprite) { max-width: 120px; }
}

@media (max-width: 620px) {
  .og-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (prefers-reduced-motion: reduce) {
  .og-ov__in { transition: none; }
}
</style>
