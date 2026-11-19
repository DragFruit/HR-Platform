<template>
  <div class="og-page og-theme og-carpet" :style="carpetVars">
    <p v-if="pending && !state" class="og-page__state">Достаём календарь...</p>
    <p v-else-if="loadError" class="og-page__state" role="alert">{{ loadError }}</p>

    <template v-else-if="state">
        <div class="og-inline" :style="{ '--og-sticky-top': `${stickyTop}px` }">
          <div class="og-wrap">
            <header class="og-top">
              <h1 class="og-top__title">ОГОНЁК 2027</h1>
              <div class="og-top__stats">
                <span class="og-score" aria-live="polite">ОГОНЬКИ <span><b>{{ doneCount }}</b>/19</span></span>
                <span class="og-score">ДО ВЕЧЕРА <b>{{ countdown }}</b></span>
              </div>
            </header>

            <OgonekGarlandBar ref="garlandRef" :days="state.days" :power="festive" />

            <main ref="stageRef" class="og-stage">
              <div class="og-stage__head">
                <h2>ДЕКАБРЬ 2026</h2>
              </div>
              <!-- Статистика живёт прямо в сетке: плитка в конце каждого ряда, лента — внизу -->
              <div class="og-grid">
                <template v-for="cell in cells" :key="cell.key">
                  <OgonekSheet
                    v-if="cell.day"
                    :ref="(c) => setSheet(cell.day!.id, c)"
                    :day="cell.day"
                    @open="openDay"
                  />

                  <div v-else-if="cell.tile === 'rank'" class="og-tile og-tile--rank">
                    <span class="og-tile__k">ВАШЕ ЗВАНИЕ</span>
                    <OgonekSprite class="og-tile__art" :rows="rankArt" width-css="62%" :alt="state.player.rank" />
                    <b class="og-tile__title">{{ state.player.rank }}</b>
                    <span class="og-tile__sub">{{ nextRankLabel }}</span>
                  </div>

                  <!-- Лидеры онлайн-партий в крестики-нолики (окно 10) -->
                  <div v-else-if="cell.tile === 'ttt'" class="og-tile og-tile--ttt">
                    <span class="og-tile__k">КРЕСТИКИ-НОЛИКИ</span>
                    <ol v-if="state.ttt.top.length" class="og-ttt">
                      <li v-for="(r, i) in state.ttt.top" :key="i" :class="{ 'is-mine': r.mine }">
                        <span class="og-ttt__n">{{ i + 1 }}</span>
                        <span class="og-ttt__name">{{ r.name }}</span>
                        <b>{{ r.wins }}</b>
                      </li>
                    </ol>
                    <span v-else class="og-tile__sub">Сыграйте онлайн с коллегой — здесь появятся лидеры</span>
                    <span v-if="state.ttt.me" class="og-tile__sub">Вы: {{ state.ttt.me.place }} место · {{ state.ttt.me.wins }} {{ plural(state.ttt.me.wins, 'победа', 'победы', 'побед') }}</span>
                    <a class="og-tile__go og-ttt__play" :href="state.ttt.url" target="_blank" rel="noopener">Играть ↗</a>
                  </div>

                  <div v-else-if="cell.tile === 'pulse'" class="og-tile og-tile--wide">
                    <template v-if="mailbox.state.value.open && mailbox.state.value.letters.length">
                      <span class="og-tile__k">КОРОБКА С ПИСЬМАМИ</span>
                      <b class="og-tile__big">{{ mailbox.state.value.letters.length }}</b>
                      <button type="button" class="og-btn og-tile__btn" @click="mailbox.show()">{{ unreadLabel }}</button>
                    </template>
                    <template v-else-if="state.todayId">
                      <span class="og-tile__k">СЕГОДНЯ</span>
                      <b class="og-tile__big">{{ state.openedToday }}</b>
                      <span class="og-tile__sub">{{ plural(state.openedToday, 'человек открыл', 'человека открыли', 'человек открыли') }} окно дня</span>
                    </template>
                    <template v-else>
                      <span class="og-tile__k">МЕТЕЛЬ</span>
                      <b class="og-tile__big">{{ state.snowflakeCount }}</b>
                      <span class="og-tile__sub">{{ plural(state.snowflakeCount, 'снежинка', 'снежинки', 'снежинок') }} от коллег</span>
                    </template>
                  </div>

                  <NuxtLink v-else-if="cell.tile === 'tree'" class="og-tile og-tile--link og-tile--tree" to="/event/ogonek/tree">
                    <span class="og-tile__k">ЁЛКА ЖЕЛАНИЙ</span>
                    <span class="og-mini-tree" aria-hidden="true">
                      <span class="og-mini-tree__img" :style="miniTree ? { backgroundImage: `url(${miniTree.url})` } : undefined" />
                      <span
                        v-for="(b, i) in miniTree?.bulbs ?? []"
                        :key="i"
                        class="og-mini-tree__bulb"
                        :style="{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, '--c': b.color, animationDelay: `${b.delay}s` }"
                      />
                    </span>
                    <span class="og-tile__sub"><b class="og-tile__num">{{ state.treeCount }}</b> {{ plural(state.treeCount, 'игрушка', 'игрушки', 'игрушек') }}</span>
                  </NuxtLink>

                  <!-- Живая доска: опрос раз в 5 с, новое въезжает сверху и вспыхивает -->
                  <div v-else-if="cell.tile === 'feed'" class="og-tile og-tile--feed og-live">
                    <div class="og-live__head">
                      <span class="og-live__on" :class="{ 'is-off': !liveOk }"><i aria-hidden="true" />{{ liveOk ? 'В ЭФИРЕ' : 'НЕТ СВЯЗИ' }}</span>
                      <span class="og-tile__k">{{ state.micro.feedTitle }}</span>
                      <span v-if="online > 0" class="og-live__online">{{ online }} {{ plural(online, 'смотрит', 'смотрят', 'смотрят') }}</span>
                    </div>
                    <p v-if="!state.feed.length" class="og-tile__sub">{{ state.micro.feedEmpty }}</p>
                    <TransitionGroup v-else name="og-live" tag="ul" class="og-live__list" aria-live="polite">
                      <li v-for="item in state.feed.slice(0, 5)" :key="item.id" :class="{ 'is-fresh': freshIds.has(item.id) }">
                        <span class="og-live__dot" :class="`og-live__dot--${item.kind}`" aria-hidden="true" />
                        <span class="og-live__text">
                          <template v-if="item.name"><b>{{ item.name }}</b> {{ item.text }}</template>
                          <template v-else>{{ item.text }}</template>
                        </span>
                        <time class="og-live__ago" :datetime="item.at">{{ agoShort(item.at) }}</time>
                      </li>
                    </TransitionGroup>
                  </div>
                </template>
              </div>
            </main>


            <!-- Панель отладки: только вне боя -->
            <div v-if="state.devTools" class="og-demo">
              <b>ОТЛАДКА</b>
              <label for="og-dev-day">Сегодня
                <select id="og-dev-day" :value="devDayValue" @change="onDevDay">
                  <option value="">все 19 открыты</option>
                  <option v-for="d in state.days" :key="d.id" :value="String(d.id)">
                    {{ Number(d.dateIso.slice(8, 10)) }} декабря · окно {{ d.id }}
                  </option>
                  <option v-for="(d, id) in OGONEK_DEV_EXTRA_DATES" :key="id" :value="String(id)">{{ d.label }}</option>
                </select>
              </label>
              <button type="button" class="og-btn og-btn--ghost" @click="resetProgress">Сбросить прогресс</button>
              <button type="button" class="og-btn og-btn--ghost" @click="replayMailbox">Коробка как при первом входе</button>
              <span class="og-demo__note">{{ devNote }}</span>
            </div>
          </div>
        </div>

      <!-- Снег над календарём: снежинки участников с подписью при наведении -->
      <Teleport to="body">
        <div v-if="festive" class="og-theme">
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
                  :submit-open="state.submitOpen"
                  :santa-open="state.santaOpen"
                  :santa-counts="state.santaCounts"
                  :ttt-url="state.ttt.url"
                  :awaiting-label="state.awaitingLabel"
                  :toy-size="state.toySize"
                  :colleagues="colleagues"
                  :recipes="state.recipes"
                  :dresscode-counts="state.dresscodeCounts"
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
import { ogonekRankArt } from '~/events/ogonek/rankArt';
import { ogonekMiniTreeImage } from '~/events/ogonek/treeArt';
import {
  CARPET_BAND_H,
  CARPET_BAND_V,
  CARPET_CORNER,
  CARPET_FIELD,
  flipX,
  flipY
} from '~/events/ogonek/carpetArt';
import { ogonekSpriteUrlByValue } from '~/utils/ogonekRender';
import { OGONEK_DEV_EXTRA_DATES, ogonekCountdownParts } from '~/events/ogonek/timeline';
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
  santa: string;
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
  submitOpen: boolean;
  santaOpen: boolean;
  santaCount: number;
  santaCounts: Record<string, number>;
  ttt: {
    url: string;
    games: number;
    top: { name: string; wins: number; games: number; mine: boolean }[];
    me: { place: number; wins: number; games: number } | null;
  };
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
  dresscodeCounts: Record<string, number>;
  treeCount: number;
  snowflakeCount: number;
  snowflakes?: { name: string; pixels: string[]; mine: boolean }[];
  player: PlayerView;
};

/** Подпись типа окна в шапке раскрытого дня. */
const KIND: Record<OgonekDayKind, string> = {
  song: 'ПЛЕЙЛИСТ', santa: 'ТАЙНЫЙ САНТА', avatar: 'АВАТАР', merch: 'МЕРЧ', plug: 'ДЕКОР', skating: 'КАТОК',
  toy: 'ЁЛКА', numbers: 'ЦИФРЫ', dresscode: 'ДРЕСС-КОД', reels: 'РИЛСЫ', tictactoe: 'ИГРА',
  photoyear: 'ФОТО', snowflake: 'СНЕЖИНКА', thanks: 'ОТКРЫТКА', teamphoto: 'ФОТО',
  minigame: 'МИНИ-ИГРА', letter: 'ПИСЬМО', olivier: 'РЕЦЕПТЫ', program: 'ПРОГРАММА', final: 'ФИНАЛ'
};

const DEV_DAY_COOKIE = 'ogonek-dev-day';

const state = ref<AdventState | null>(null);
const pending = ref(true);
const loadError = ref('');
const busy = ref(false);
const toastText = ref('');

const { employees, hydrate } = useEmployees();
const decor = useOgonekDecor();
const { festive } = decor;
const mailbox = useOgonekMailbox();
/**
 * Сетка 6 колонок: плитка в конце каждого ряда — звание, лидеры
 * крестиков-ноликов (сразу после окна 10), ёлка; последний ряд замыкает
 * широкая плитка «сегодня / коробка», под ней на всю ширину живая лента.
 */
type Cell = { key: string; day?: OgonekDayView; tile?: 'rank' | 'pulse' | 'tree' | 'feed' | 'ttt' };
const TILE_AFTER: Record<number, NonNullable<Cell['tile']>[]> = { 5: ['rank'], 10: ['ttt'], 15: ['tree'], 19: ['pulse', 'feed'] };
const cells = computed<Cell[]>(() => {
  const out: Cell[] = [];
  (state.value?.days ?? []).forEach((day, i) => {
    out.push({ key: `d${day.id}`, day });
    for (const tile of TILE_AFTER[i + 1] ?? []) out.push({ key: `t-${tile}`, tile });
  });
  return out;
});

/** Пушистая ёлка в плитке: рисуется на canvas, поэтому только в браузере. */
const miniTree = ref<ReturnType<typeof ogonekMiniTreeImage> | null>(null);

const rankArt = computed(() => ogonekRankArt(state.value?.player.rank ?? ''));
const nextRankLabel = computed(() => {
  const s = state.value;
  if (!s) return '';
  const opened = s.player.opened.length;
  const next = s.ranks.find((r) => r.from > opened);
  if (!next) return 'Выше званий нет';
  const left = next.from - opened;
  return `Ещё ${left} ${plural(left, 'окно', 'окна', 'окон')} до «${next.title}»`;
});

function plural(n: number, one: string, few: string, many: string) {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
}

const unreadLabel = computed(() => {
  const all = mailbox.state.value.letters;
  const unread = all.filter((l) => !l.read).length;
  return unread ? `не вскрыто ${unread} из ${all.length}` : `все ${all.length} прочитаны, можно перечитать`;
});

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

/**
 * Ковёр под календарём: картинки рисуются на клиенте и отдаются стилям
 * переменными. До отрисовки сцена просто тёмно-бордовая.
 */
const carpetVars = ref<Record<string, string>>({});
function paintCarpet() {
  const url = (rows: readonly string[]) => `url(${ogonekSpriteUrlByValue(rows)})`;
  carpetVars.value = {
    '--og-c-tl': url(CARPET_CORNER),
    '--og-c-tr': url(flipX(CARPET_CORNER)),
    '--og-c-bl': url(flipY(CARPET_CORNER)),
    '--og-c-br': url(flipX(flipY(CARPET_CORNER))),
    '--og-b-top': url(CARPET_BAND_H),
    '--og-b-bottom': url(flipY(CARPET_BAND_H)),
    '--og-b-left': url(CARPET_BAND_V),
    '--og-b-right': url(flipX(CARPET_BAND_V)),
    '--og-field': url(CARPET_FIELD)
  };
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
    decor.setHat(state.value.player.hat, state.value.player.userId);
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

/**
 * Куда раскрывается день: по центру видимой части страницы, а не в рамку
 * календаря, иначе окно уезжает за экран и его приходится догонять скроллом.
 * По ширине — как сцена, по высоте — по содержимому. Длинное содержимое
 * прокручивается внутри окна.
 */
function overlayFrame() {
  const m = 8;
  const vw = window.innerWidth;
  const minTop = stickyTop.value + m;
  const s = stageRef.value?.getBoundingClientRect();
  const left = s ? Math.max(s.left, m) : m;
  const right = s ? Math.min(s.right, vw - m) : vw - m;
  return { left, width: right - left, minTop, avail: window.innerHeight - minTop - m };
}

function targetRect(contentH?: number) {
  const f = overlayFrame();
  const height = Math.min(contentH ?? f.avail, f.avail);
  return { left: f.left, top: f.minTop + (f.avail - height) / 2, width: f.width, height };
}

/** Меряем окно по содержимому и ставим по центру. */
function fitOverlay() {
  const ov = overlayRef.value;
  if (!ov) return targetRect();
  ov.style.height = 'auto';
  const box = targetRect(ov.offsetHeight);
  ov.style.height = `${box.height}px`;
  overlayBox.value = px(box);
  return box;
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
  overlayBox.value = px(targetRect());
  overlayReady.value = false;
  openId.value = id;
  await nextTick();

  const to = fitOverlay();
  await nextTick();
  const ov = overlayRef.value;
  if (ov && from && !reduce()) {
    await ov.animate(
      [{ ...px(from), borderColor: '#9a2836' }, { ...px(to), borderColor: '#ffcf4a' }],
      { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' }
    ).finished;
  }
  overlayReady.value = true;
  closeRef.value?.focus({ preventScroll: true });
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
    if (kind === 'hat') decor.setHat(Boolean(payload.on), state.value.player.userId);
    await load();
    // Содержимое могло вырасти: появился штамп, новая подпись.
    await nextTick();
    if (openId.value !== null) fitOverlay();
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

/* ------------------------------------------------------- живая доска */

const online = ref(0);
const liveOk = ref(true);
/** Записи, пришедшие с последним опросом: подсвечиваются на несколько секунд. */
const freshIds = ref(new Set<string>());

async function refreshFeed() {
  try {
    const res = await $fetch<{ feed: OgonekFeedItem[]; online: number }>('/api/event/ogonek/feed');
    liveOk.value = true;
    online.value = res.online;
    if (!state.value) return;
    const known = new Set(state.value.feed.map((f) => f.id));
    const fresh = res.feed.filter((f) => !known.has(f.id)).map((f) => f.id);
    state.value.feed = res.feed;
    if (fresh.length && known.size) {
      freshIds.value = new Set(fresh);
      setTimeout(() => { freshIds.value = new Set(); }, 4000);
    }
  } catch {
    // Лента не критична: показываем, что связь пропала, и пробуем дальше
    liveOk.value = false;
  }
}

/** «сейчас», «3 мин», «2 ч» — по серверным часам, тикает каждую секунду. */
function agoShort(at: string) {
  const sec = Math.max(0, Math.round((nowMs.value + clockSkew.value - Date.parse(at)) / 1000));
  if (sec < 45) return 'сейчас';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

const FEED_POLL_MS = 5000;
/** Фоновая вкладка не опрашивает сервер; вернулись — сразу свежие данные. */
function pollFeed() {
  if (document.visibilityState === 'visible') void refreshFeed();
}
function onVisibility() {
  if (document.visibilityState === 'visible') void refreshFeed();
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
  if (state.value.devDay && state.value.devDay > 19) return 'Коробка с письмами открыта с 28 декабря по 22 января.';
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
  void mailbox.refresh();
}

async function replayMailbox() {
  try {
    await mailbox.devReset();
    if (!mailbox.state.value.open) toast('В выбранный день коробка закрыта');
  } catch (err) {
    toast(errText(err));
  }
}

async function resetProgress() {
  try {
    await $fetch('/api/event/ogonek/submit', { method: 'POST', body: { kind: 'devReset' } });
    await load();
    void decor.refresh();
    toast('Прогресс сброшен: листки целые, огоньки погашены, колпак снят, вилка вынута');
  } catch (err) {
    toast(errText(err));
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  if (openId.value !== null) void closeDay();
}

function onResize() {
  measureStickyTop();
  if (openId.value !== null && !busy.value) fitOverlay();
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
  // Зубчатый край оторванного листка — один раз на страницу.
  const pts = ['0 0', '100% 0'];
  for (let i = 24; i >= 0; i--) pts.push(`${((i / 24) * 100).toFixed(2)}% calc(100% - ${i % 2 ? 0 : 6}px)`);
  document.documentElement.style.setProperty('--og-zig', `polygon(${pts.join(',')})`);

  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  measureStickyTop();
  paintCarpet();
  miniTree.value = ogonekMiniTreeImage();
  tick = setInterval(() => { nowMs.value = Date.now(); }, 1000);
  feedTimer = setInterval(pollFeed, FEED_POLL_MS);
  document.addEventListener('visibilitychange', onVisibility);
  void refreshFeed();
  void hydrate();
  await load();
  void decor.refresh();
  // Ссылка вида /event/ogonek?day=6 (например «Повесить свою» с ёлки) сразу открывает окно
  const askDay = Number(useRoute().query.day);
  if (Number.isInteger(askDay) && askDay >= 1 && askDay <= 19) {
    await nextTick();
    void openDay(askDay);
    void useRouter().replace({ query: {} });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', onResize);
  document.body.classList.remove('og-locked-scroll');
  if (tick) clearInterval(tick);
  if (feedTimer) clearInterval(feedTimer);
  document.removeEventListener('visibilitychange', onVisibility);
});
</script>

<style scoped>
.og-page {
  min-height: 60vh;
  font-size: 16px;
  line-height: 1.5;
}

.og-page__state { color: var(--og-muted); }


.og-wrap {
  max-width: 1280px;
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
/* Ковёр — весь ивент целиком: одна рамка по краю, без вложенных */
.og-carpet {
  /* Пиксель ковра — ровно 2 экранных: бордюр 56px, поле 48px */
  --og-band: 56px;
  background-color: #4e0f19;
  background-image:
    var(--og-c-tl), var(--og-c-tr), var(--og-c-bl), var(--og-c-br),
    var(--og-b-top), var(--og-b-bottom), var(--og-b-left), var(--og-b-right),
    var(--og-field);
  background-position:
    left top, right top, left bottom, right bottom,
    left top, left bottom, left top, right top,
    var(--og-band) var(--og-band);
  background-repeat:
    no-repeat, no-repeat, no-repeat, no-repeat,
    repeat-x, repeat-x, repeat-y, repeat-y,
    repeat;
  background-size:
    var(--og-band) var(--og-band), var(--og-band) var(--og-band),
    var(--og-band) var(--og-band), var(--og-band) var(--og-band),
    28px var(--og-band), 28px var(--og-band), var(--og-band) 28px, var(--og-band) 28px,
    48px 48px;
  image-rendering: pixelated;
  padding: calc(var(--og-band) + 18px) calc(var(--og-band) + 16px) calc(var(--og-band) + 24px);
}

.og-stage { position: relative; margin-top: 6px; }

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
  grid-template-columns: repeat(6, minmax(0, 1fr));
  /* По горизонтали шире: на большом экране календарь не жмётся к середине */
  gap: clamp(10px, 1.6vw, 16px) clamp(12px, 2.6vw, 40px);
}

/* ——— плитки статистики в сетке календаря ——— */
.og-tile {
  aspect-ratio: 3 / 4;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 8px;
  text-align: center;
  background: rgba(30, 12, 14, 0.45);
  border: 2px dashed rgba(255, 207, 74, 0.28);
  color: var(--og-ink, #f6d9d6);
  text-decoration: none;
}

.og-tile__k { font-family: var(--og-pixel); font-size: 8px; letter-spacing: 0.06em; color: var(--og-gold-soft); }
.og-tile__big { font-family: var(--og-pixel); font-size: clamp(22px, 2.6vw, 30px); color: var(--og-gold); line-height: 1.2; }
.og-tile__title { font-size: 15px; line-height: 1.2; color: var(--og-gold); }
.og-tile__sub { font-size: 13px; line-height: 1.3; color: var(--og-muted); margin: 0; }
.og-tile__go { font-family: var(--og-pixel); font-size: 8px; color: var(--og-gold-soft); margin-top: 4px; }
.og-tile__btn { font-size: 8px; padding: 8px 10px; }
.og-tile__art { margin: 2px 0; }

.og-tile--link { cursor: pointer; transition: border-color 0.15s ease, background-color 0.15s ease; }
.og-tile--link:hover { border-color: var(--og-gold); background: rgba(30, 12, 14, 0.6); }

.og-tile--tree { justify-content: space-between; gap: 2px; }
.og-tile__num { font-family: var(--og-pixel); font-size: 13px; color: var(--og-gold); font-weight: 400; }

.og-mini-tree {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  max-width: 150px;
  aspect-ratio: 76 / 96;
}
.og-mini-tree__img {
  position: absolute;
  inset: 0;
  background: center / contain no-repeat;
  image-rendering: pixelated;
  transition: transform 0.25s ease;
}
.og-tile--tree:hover .og-mini-tree__img { transform: translateY(-2px) scale(1.03); }
.og-mini-tree__bulb {
  position: absolute;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--c) 0, transparent 70%);
  animation: og-mini-bulb 3.2s ease-in-out infinite;
  pointer-events: none;
}
@keyframes og-mini-bulb { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.85; } }
@media (prefers-reduced-motion: reduce) { .og-mini-tree__bulb { animation: none; opacity: 0.5; } }

.og-tile--wide { grid-column: span 2; aspect-ratio: auto; }

/* Лидеры крестиков-ноликов: топ-5 по победам в онлайн-партиях */
.og-tile--ttt { justify-content: flex-start; padding-top: 14px; }
.og-ttt { list-style: none; margin: 2px 0 0; padding: 0; width: 100%; display: flex; flex-direction: column; gap: 3px; font-size: 13px; color: #f6d9d6; }
.og-ttt li { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; gap: 6px; align-items: baseline; text-align: left; }
.og-ttt li.is-mine { color: var(--og-gold); }
.og-ttt__n { font-family: var(--og-pixel); font-size: 8px; color: var(--og-gold-soft); }
.og-ttt__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.og-ttt b { font-variant-numeric: tabular-nums; color: var(--og-gold); }
.og-ttt__play { margin-top: auto; text-decoration: none; }

/* Живая лента — отдельным рядом на всю ширину под календарём */
.og-tile--feed {
  grid-column: 1 / -1;
  aspect-ratio: auto;
  align-items: stretch;
  justify-content: flex-start;
  text-align: left;
  padding: 12px 14px;
}

.og-live { gap: 8px; }
.og-live__head { display: flex; align-items: center; gap: 10px; }
.og-live__on {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--og-pixel);
  font-size: 7px;
  letter-spacing: 0.08em;
  color: #ffb3b3;
  padding: 4px 6px;
  background: rgba(224, 70, 79, 0.18);
}
.og-live__on i { width: 7px; height: 7px; border-radius: 50%; background: #ff4d5a; animation: og-live-pulse 1.4s ease-in-out infinite; }
.og-live__on.is-off { color: var(--og-muted); background: rgba(255, 255, 255, 0.06); }
.og-live__on.is-off i { background: #8a6b6e; animation: none; }
@keyframes og-live-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 77, 90, 0.6); }
  50% { box-shadow: 0 0 0 5px rgba(255, 77, 90, 0); }
}
.og-live__online { margin-left: auto; font-size: 12px; color: var(--og-muted); white-space: nowrap; }

.og-live__list {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  line-height: 1.3;
  color: #f6d9d6;
}
.og-live__list li {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  margin: 0 -6px;
  transition: background-color 1.2s ease;
}
.og-live__list li.is-fresh { background: rgba(255, 207, 74, 0.16); transition: none; }
.og-live__list b { color: #fff3e6; font-weight: 700; }
.og-live__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.og-live__ago { font-size: 11px; color: var(--og-muted); font-variant-numeric: tabular-nums; }

.og-live__dot { width: 8px; height: 8px; background: var(--og-gold-soft); }
.og-live__dot--toy { background: #e0464f; }
.og-live__dot--snowflake { background: #7ad8cf; }
.og-live__dot--thanks { background: #f8b386; }
.og-live__dot--window { background: #ffd35c; }
.og-live__dot--recipe { background: #f4e6c8; }
.og-live__dot--letter { background: #2fa7a8; }
.og-live__dot--plug { background: #45bd68; }
.og-live__dot--santa { background: #ff7466; }

/* Новое въезжает сверху, старое уходит вниз и тает */
.og-live-enter-active { transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1); }
.og-live-enter-from { opacity: 0; transform: translateY(-10px); }
.og-live-leave-active { position: absolute; left: 6px; right: 6px; transition: opacity 0.3s ease; }
.og-live-leave-to { opacity: 0; }
.og-live-move { transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1); }

@media (prefers-reduced-motion: reduce) {
  .og-live__on i { animation: none; }
  .og-live-enter-active, .og-live-move { transition: none; }
}

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
/* Снег в полном экране идёт поверх календаря, но под раскрытым днём */

.og-ov {
  box-sizing: border-box;
  position: fixed;
  /* Выше слоя полного экрана (70), иначе день открывается под ним */
  z-index: 75;
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
  .og-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 700px) {
  .og-ov__body { grid-template-columns: 1fr; }
  .og-art { max-width: 240px; margin: 0 auto; padding: 30px 16px 16px; }
  .og-art :deep(.og-sprite) { max-width: 120px; }
}

@media (max-width: 620px) {
  .og-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .og-ov__in { transition: none; }
}
</style>
