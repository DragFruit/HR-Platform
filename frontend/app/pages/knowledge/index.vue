<template>
  <div class="kb-page kb-page--search" :data-mode="mode">
    <aside
      v-if="rateVisible"
      ref="rateHostRef"
      class="kb-rate-cat"
      aria-label="Оценка страницы"
    >
      <p v-if="rateReady && rateStep === 'stars'" class="kb-rate-cat__ask">Оцените удобство этой страницы</p>
      <div v-if="rateStep === 'thanks' || rateStep === 'comment'" class="kb-rate-cat__panel">
        <p class="kb-rate-cat__thanks">Спасибо!</p>
        <form v-if="rateStep === 'comment'" class="kb-rate-cat__form" @submit.prevent="sendFeedback">
          <textarea
            v-model="rateComment"
            class="kb-rate-cat__comment"
            rows="2"
            maxlength="2000"
            placeholder="Как можно улучшить этот раздел?"
          />
          <button type="submit" class="kb-rate-cat__send">Отправить</button>
        </form>
      </div>

      <div
        ref="rateStageRef"
        class="kb-rate-cat__stage"
        :class="{ 'is-ready': rateReady, [`is-${rateStep}`]: true }"
      >
        <video
          ref="rateVideoRef"
          class="kb-rate-cat__video"
          src="/knowledge/rating-cat.webm"
          muted
          playsinline
          preload="auto"
          @ended="onRateVideoEnded"
        />
        <img
          class="kb-rate-cat__tail"
          src="/knowledge/rating-paper-tail.png"
          alt=""
          width="102"
          height="180"
          draggable="false"
        />
        <div
          class="kb-rate-cat__paper"
          :class="{ 'is-live': rateReady }"
          role="group"
          aria-label="Оценка от 1 до 5"
        >
          <button
            v-for="n in 5"
            :key="n"
            type="button"
            class="kb-rate-cat__star"
            :class="{ 'is-on': n <= (rateHover || rateStars) }"
            :disabled="!rateReady || rateStep !== 'stars'"
            :aria-label="`${n} из 5`"
            @mouseenter="rateHover = n"
            @mouseleave="rateHover = 0"
            @click="pickStars(n)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2.4l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.2 6.2 20.3l1.1-6.5L2.6 9.2l6.5-.9L12 2.4z"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <section class="kb-console" aria-label="Поиск по базе знаний">
      <h2 class="kb-console__title">Найти в базе</h2>

      <div class="kb-modes" role="tablist" aria-label="Режим поиска">
        <button
          type="button"
          class="kb-mode"
          :class="{ 'is-on': mode === 'classic' }"
          role="tab"
          :aria-selected="mode === 'classic'"
          @click="setMode('classic')"
        >
          Поиск
        </button>
        <button
          type="button"
          class="kb-mode"
          :class="{ 'is-on': mode === 'ai' }"
          role="tab"
          :aria-selected="mode === 'ai'"
          @click="setMode('ai')"
        >
          Спросить ИИ
        </button>
      </div>

      <form v-if="mode === 'classic'" class="kb-seek" @submit.prevent="onClassicSubmit">
        <div class="kb-seek__field">
          <input
            v-model="draftQuery"
            type="text"
            class="kb-seek__input"
            autocomplete="off"
            aria-label="Найти по базе"
            @input="onQueryInput"
          />
          <span v-if="!draftQuery" class="kb-seek__ghost" aria-hidden="true">
            {{ placeholderText }}<i class="kb-seek__caret" />
          </span>
        </div>
        <button type="submit" class="kb-seek__go">Искать</button>
      </form>
      <form v-else class="kb-seek" @submit.prevent="onAiSubmit">
        <input
          v-model="aiDraft"
          type="text"
          class="kb-seek__input"
          placeholder="Например: сколько дней отпуска в аванс"
          autocomplete="off"
          aria-label="Спросить ИИ"
        />
        <button type="submit" class="kb-seek__go">Спросить</button>
      </form>

      <div v-if="KB_FILTERS_ENABLED && mode === 'classic'" class="kb-filters" role="group" aria-label="Быстрые фильтры">
        <button
          type="button"
          class="kb-filter-btn"
          :class="{ 'is-on': filterOpen || detailFilterCount > 0 }"
          :aria-expanded="filterOpen"
          aria-haspopup="dialog"
          :aria-label="detailFilterCount ? `Фильтры, выбрано ${detailFilterCount}` : 'Фильтры'"
          @click="filterOpen = !filterOpen"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M4 6h16l-6.2 7.4V18l-3.6 2v-6.6L4 6z"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linejoin="round"
            />
          </svg>
          <span v-if="detailFilterCount" class="kb-filter-btn__count">{{ detailFilterCount }}</span>
        </button>
        <button
          v-for="topic in visibleTopics"
          :key="topic"
          type="button"
          class="kb-chip"
          :class="{ 'is-on': draftFilters.topic === topic }"
          @click="toggleTopic(topic)"
        >
          {{ topic }}
        </button>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="KB_FILTERS_ENABLED && mode === 'classic' && filterOpen"
        class="kb-filter-layer"
        @click.self="filterOpen = false"
      >
        <div
          ref="filterPopRef"
          class="kb-filter-pop"
          role="dialog"
          aria-label="Настройка фильтров"
        >
          <div class="kb-filter-pop__head">
            <h3 class="kb-filter-pop__title">Фильтры</h3>
            <button type="button" class="kb-filter-pop__close" aria-label="Закрыть" @click="filterOpen = false">
              ×
            </button>
          </div>

          <div class="kb-filter-pop__section">
            <p class="kb-filter-pop__label">Тип</p>
            <div class="kb-filter-pop__row">
              <button
                type="button"
                class="kb-chip"
                :class="{ 'is-on': draftFilters.type === 'regulation' }"
                @click="toggleType('regulation')"
              >
                Регламент
              </button>
              <button
                type="button"
                class="kb-chip"
                :class="{ 'is-on': draftFilters.type === 'faq' }"
                @click="toggleType('faq')"
              >
                FAQ
              </button>
            </div>
          </div>

          <div v-if="extraTopics.length" class="kb-filter-pop__section">
            <p class="kb-filter-pop__label">Ещё тематики</p>
            <div class="kb-filter-pop__row">
              <button
                v-for="topic in extraTopics"
                :key="topic"
                type="button"
                class="kb-chip"
                :class="{ 'is-on': draftFilters.topic === topic }"
                @click="toggleTopic(topic)"
              >
                {{ topic }}
              </button>
            </div>
          </div>

          <div class="kb-filter-pop__section">
            <p class="kb-filter-pop__label">Период</p>
            <div class="kb-filter-pop__dates">
              <label>
                С
                <input v-model="draftFilters.dateFrom" type="date" />
              </label>
              <label>
                По
                <input v-model="draftFilters.dateTo" type="date" />
              </label>
            </div>
          </div>

          <div class="kb-filter-pop__section">
            <p class="kb-filter-pop__label">Автор</p>
            <select v-model="draftFilters.author" class="kb-filter-pop__select" aria-label="Автор">
              <option value="">Все авторы</option>
              <option v-for="name in authors" :key="name" :value="name">{{ name }}</option>
            </select>
          </div>

          <div class="kb-filter-pop__foot">
            <button type="button" class="kb-filter-pop__clear" @click="clearDetailFilters">Сбросить</button>
            <button type="button" class="kb-filter-pop__done" @click="filterOpen = false">Готово</button>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="kb-stage">
      <div
        v-if="mode === 'classic'"
        ref="resultsRef"
        class="kb-results"
        role="list"
        aria-label="Результаты поиска"
      >
        <template v-if="hasSearched">
          <NuxtLink
            v-for="hit in visibleHits"
            :key="hit.card.id"
            :to="`/knowledge/${hit.card.id}`"
            class="kb-hit"
            role="listitem"
          >
            <span class="kb-hit__title">
              <template v-for="(part, idx) in hit.titleParts" :key="`${hit.card.id}-${idx}`">
                <mark v-if="part.hit">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </template>
            </span>
          </NuxtLink>
          <p v-if="!hits.length" class="kb-empty muted">Ничего не нашли — попробуй другой запрос.</p>
          <div v-if="hasMore" ref="sentinelRef" class="kb-results__sentinel" aria-hidden="true" />
        </template>
      </div>

      <div v-else ref="threadRef" class="kb-thread" role="log" aria-live="polite" aria-label="Диалог с ИИ">
        <div class="kb-thread__pin">
          <article
            v-for="msg in messages"
            :key="msg.id"
            class="kb-bubble"
            :class="`kb-bubble--${msg.from}`"
          >
            <p v-if="msg.from === 'user'" class="kb-bubble__text">{{ msg.text }}</p>
            <p v-else class="kb-bubble__text">
              <template v-for="(part, idx) in msg.parts ?? []" :key="`${msg.id}-${idx}`">
                <NuxtLink
                  v-if="part.type === 'cite'"
                  :to="`/knowledge/${part.id}`"
                  class="kb-cite"
                >
                  {{ part.title }}
                </NuxtLink>
                <template v-else>{{ part.value }}</template>
              </template>
            </p>
          </article>
          <p v-if="aiError" class="kb-empty muted" role="alert">{{ aiError }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { knowledgeAuthors, knowledgeCategories } from '~/data/knowledgeBaseCatalog';
import { KNOWLEDGE_SEARCH_PHRASES } from '~/data/knowledgeSearchPhrases';

/** Фильтры спрятаны, код не удалять — вернуть `true`, если снова нужны. */
const KB_FILTERS_ENABLED = false;

const RATE_STORAGE_KEY = 'vbi-kb-page-rating-v1';
/** Стоп сдвига виджета = 2.8 с; ролик доигрывает. */
const RATE_WALK_END_SEC = 2.8;
const RATE_STAGE_W = 944;
const RATE_STAGE_H = 720;
const RATE_TAIL_W = 102;
const RATE_TAIL_OVERLAP = 12;
const RATE_NOTCH = 52;
/** [t, left, top, right, bot] бумажки в пикселях ролика 848×720 */
const RATE_PAPER_KEYS: number[][] = [
  [0, 439, 319, 791, 471],
  [0.0667, 438, 316, 791, 468],
  [0.1333, 440, 306, 790, 459],
  [0.2, 441, 317, 793, 468],
  [0.2667, 443, 359, 801, 511],
  [0.3333, 444, 356, 803, 507],
  [0.4, 445, 349, 803, 501],
  [0.4667, 446, 339, 804, 490],
  [0.5333, 446, 329, 804, 481],
  [0.6, 447, 325, 804, 476],
  [0.6667, 448, 313, 804, 466],
  [0.7333, 448, 310, 804, 463],
  [0.8, 451, 326, 810, 479],
  [0.8667, 452, 348, 814, 501],
  [0.9333, 455, 355, 818, 509],
  [1, 456, 343, 821, 497],
  [1.0667, 458, 332, 820, 486],
  [1.1333, 460, 326, 822, 480],
  [1.2, 462, 316, 822, 472],
  [1.2667, 465, 315, 825, 471],
  [1.3333, 469, 355, 837, 510],
  [1.4, 471, 359, 838, 515],
  [1.4667, 473, 349, 839, 507],
  [1.5333, 474, 333, 841, 490],
  [1.6, 476, 319, 841, 475],
  [1.6667, 481, 322, 847, 479],
  [1.7333, 483, 341, 847, 498],
  [1.8, 488, 364, 847, 521],
  [1.8667, 489, 357, 847, 515],
  [1.9333, 493, 339, 847, 495],
  [2, 496, 326, 847, 484],
  [2.0667, 498, 319, 847, 477],
  [2.1333, 502, 319, 847, 478],
  [2.2, 505, 343, 847, 501],
  [2.2667, 509, 365, 847, 523],
  [2.3333, 513, 355, 847, 514],
  [2.4, 516, 345, 847, 505],
  [2.4667, 521, 343, 847, 502],
  [2.5333, 524, 331, 847, 492],
  [2.6, 531, 328, 847, 490],
  [2.6667, 538, 355, 847, 516],
  [2.7333, 541, 363, 847, 525],
  [2.8, 551, 374, 847, 535],
  [2.8667, 557, 364, 847, 527],
  [2.9333, 567, 356, 847, 520],
  [3, 578, 355, 847, 518],
  [3.0667, 582, 353, 847, 517],
  [3.1333, 593, 352, 847, 517],
  [3.2, 596, 363, 847, 528],
  [3.2667, 596, 385, 847, 553],
  [3.3333, 596, 392, 847, 562],
  [3.4, 596, 392, 847, 562],
  [3.4667, 596, 391, 847, 562]
];

type SearchMode = 'classic' | 'ai';
type RateStep = 'stars' | 'thanks' | 'comment';

const {
  draftQuery,
  draftFilters,
  hasSearched,
  hits,
  visibleHits,
  hasMore,
  runSearch,
  loadMore
} = useKnowledgeSearch();

const { messages, error: aiError, hydrate, send } = useKnowledgeAiChat();
const { text: placeholderText, stop: stopPlaceholder } = useKnowledgePlaceholder(KNOWLEDGE_SEARCH_PHRASES);

const QUICK_TOPICS = ['Отпуска', 'Адаптация', 'Банк идей'];

const mode = ref<SearchMode>('classic');
const filterOpen = ref(false);
const aiDraft = ref('');
const resultsRef = ref<HTMLElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);
const threadRef = ref<HTMLElement | null>(null);
const filterPopRef = ref<HTMLElement | null>(null);

const authors = knowledgeAuthors();
const topics = knowledgeCategories();
const quickTopics = QUICK_TOPICS.filter((topic) => topics.includes(topic));
const extraTopics = topics.filter((topic) => !QUICK_TOPICS.includes(topic));

const visibleTopics = computed(() => {
  const selected = draftFilters.value.topic;
  if (selected && extraTopics.includes(selected) && !quickTopics.includes(selected)) {
    return [...quickTopics, selected];
  }
  return quickTopics;
});

const detailFilterCount = computed(() => {
  let count = 0;
  if (draftFilters.value.type) count += 1;
  if (draftFilters.value.dateFrom || draftFilters.value.dateTo) count += 1;
  if (draftFilters.value.author) count += 1;
  if (draftFilters.value.topic && extraTopics.includes(draftFilters.value.topic)) count += 1;
  return count;
});

const clearDetailFilters = () => {
  draftFilters.value.type = '';
  draftFilters.value.dateFrom = '';
  draftFilters.value.dateTo = '';
  draftFilters.value.author = '';
  if (draftFilters.value.topic && extraTopics.includes(draftFilters.value.topic)) {
    draftFilters.value.topic = '';
  }
};

const onDocPointer = (event: PointerEvent) => {
  if (!filterOpen.value) return;
  const target = event.target as Node | null;
  const host = filterPopRef.value;
  const toggle = (event.target as HTMLElement | null)?.closest?.('.kb-filter-btn');
  if (toggle) return;
  if (host && target && !host.contains(target)) filterOpen.value = false;
};

const onDocKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') filterOpen.value = false;
};

const setMode = (next: SearchMode) => {
  if (next === mode.value) return;
  filterOpen.value = false;
  mode.value = next;
  if (next === 'ai') nextTick(() => scrollThread());
};

const toggleType = (value: 'regulation' | 'faq') => {
  draftFilters.value.type = draftFilters.value.type === value ? '' : value;
};

const toggleTopic = (topic: string) => {
  draftFilters.value.topic = draftFilters.value.topic === topic ? '' : topic;
};

const rateVisible = ref(false);
const rateReady = ref(false);
const rateStep = ref<RateStep>('stars');
const rateStars = ref(0);
const rateHover = ref(0);
const rateComment = ref('');
const rateVideoRef = ref<HTMLVideoElement | null>(null);
const rateStageRef = ref<HTMLElement | null>(null);
const rateHostRef = ref<HTMLElement | null>(null);
let rateHideTimer: ReturnType<typeof setTimeout> | null = null;
let rateShowTimer: ReturnType<typeof setTimeout> | null = null;
let rateRaf = 0;
let rateSyncing = false;
let rateWalkParked = false;
let rateLeaving = false;

function lerpPaper(t: number): number[] {
  const keys = RATE_PAPER_KEYS;
  if (t <= keys[0][0]) return keys[0];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const a = keys[i - 1];
      const b = keys[i];
      const p = (t - a[0]) / (b[0] - a[0] || 1);
      return a.map((v, idx) => v + (b[idx] - v) * p);
    }
  }
  return last;
}

function paperCssVars(box: number[]): Record<string, string> {
  const left = box[1];
  const top = box[2];
  const right = box[3];
  const bot = box[4];
  const join = right - RATE_TAIL_OVERLAP;
  const ph = bot - top;
  const starLeft = left + ph * 0.22;
  const starRight = join + RATE_TAIL_W - RATE_NOTCH - ph * 0.12;
  const starTop = top + ph * 0.16;
  const starH = ph * 0.68;
  const pct = (n: number, den: number) => `${((n / den) * 100).toFixed(3)}%`;
  return {
    '--tail-left': pct(join, RATE_STAGE_W),
    '--tail-top': pct(top - 1, RATE_STAGE_H),
    '--tail-h': pct(ph + 2, RATE_STAGE_H),
    '--stars-left': pct(starLeft, RATE_STAGE_W),
    '--stars-top': pct(starTop, RATE_STAGE_H),
    '--stars-w': pct(Math.max(8, starRight - starLeft), RATE_STAGE_W),
    '--stars-h': pct(starH, RATE_STAGE_H)
  };
}

const syncRatePaper = (t: number) => {
  const el = rateStageRef.value;
  if (!el) return;
  const vars = paperCssVars(lerpPaper(t));
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
};

const alreadyRated = () => {
  try {
    return Boolean(localStorage.getItem(RATE_STORAGE_KEY));
  } catch {
    return false;
  }
};

const markRated = () => {
  try {
    localStorage.setItem(RATE_STORAGE_KEY, JSON.stringify({ at: new Date().toISOString(), stars: rateStars.value }));
  } catch {
    /* ignore */
  }
};

const applyWalkTransform = (t: number) => {
  const host = rateHostRef.value;
  if (!host || rateLeaving) return;
  if (rateWalkParked || t >= RATE_WALK_END_SEC) {
    host.style.transform = 'translateX(0)';
    rateWalkParked = true;
    return;
  }
  const pct = (1 - t / RATE_WALK_END_SEC) * 100;
  host.style.transform = `translateX(${pct.toFixed(3)}%)`;
};

const syncRateFrame = (t: number) => {
  applyWalkTransform(t);
  syncRatePaper(t);
};

const stopRateSync = () => {
  rateSyncing = false;
  if (rateRaf) {
    cancelAnimationFrame(rateRaf);
    rateRaf = 0;
  }
};

const loopRateSync = (_now?: number, meta?: { mediaTime: number }) => {
  if (!rateSyncing) return;
  const video = rateVideoRef.value;
  const t = meta?.mediaTime ?? video?.currentTime ?? 0;
  syncRateFrame(t);
  if (!video || video.ended) {
    rateSyncing = false;
    return;
  }
  if (typeof video.requestVideoFrameCallback === 'function') {
    video.requestVideoFrameCallback(loopRateSync);
    return;
  }
  rateRaf = requestAnimationFrame(loopRateSync);
};

const startRateSync = () => {
  stopRateSync();
  rateSyncing = true;
  loopRateSync();
};

const hideRate = () => {
  rateLeaving = true;
  rateWalkParked = true;
  stopRateSync();
  const host = rateHostRef.value;
  if (host) {
    host.style.transition = 'transform 1.1s linear';
    host.style.transform = 'translateX(110%)';
  }
  rateHideTimer = setTimeout(() => {
    rateVisible.value = false;
  }, 1100);
};

const onRateVideoEnded = () => {
  stopRateSync();
  syncRateFrame(RATE_PAPER_KEYS[RATE_PAPER_KEYS.length - 1][0]);
  rateReady.value = true;
};

const playRateVideo = async () => {
  await nextTick();
  const video = rateVideoRef.value;
  const host = rateHostRef.value;
  if (!video) return;
  rateWalkParked = false;
  rateLeaving = false;
  if (host) {
    host.style.transition = 'none';
    host.style.transform = 'translateX(100%)';
  }
  syncRatePaper(0);
  try {
    video.pause();
    video.currentTime = 0;
    await video.play();
    startRateSync();
  } catch (err) {
    console.warn('[knowledge] rating video play failed:', err);
    if (host) host.style.transform = 'translateX(0)';
    rateWalkParked = true;
    rateReady.value = true;
  }
};

const submitRating = async (comment: string) => {
  markRated();
  try {
    await $fetch('/api/knowledge/feedback', {
      method: 'POST',
      body: { stars: rateStars.value, comment, page: '/knowledge' }
    });
  } catch (err) {
    console.warn('[knowledge] feedback failed:', err);
  }
};

const pickStars = async (n: number) => {
  if (!rateReady.value || rateStep.value !== 'stars') return;
  rateStars.value = n;
  if (n >= 5) {
    rateStep.value = 'thanks';
    await submitRating('');
    rateHideTimer = setTimeout(hideRate, 1600);
    return;
  }
  rateStep.value = 'comment';
};

const sendFeedback = async () => {
  await submitRating(rateComment.value.trim());
  rateStep.value = 'thanks';
  rateHideTimer = setTimeout(hideRate, 1200);
};

const onQueryInput = () => {
  if (draftQuery.value) stopPlaceholder();
};

const onClassicSubmit = () => {
  if (draftQuery.value) stopPlaceholder();
  runSearch();
};

const onAiSubmit = () => {
  const text = aiDraft.value;
  aiDraft.value = '';
  send(text);
  nextTick(() => scrollThread());
};

const scrollThread = () => {
  const el = threadRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
};

let observer: IntersectionObserver | null = null;

const bindSentinel = () => {
  observer?.disconnect();
  if (!sentinelRef.value) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    },
    { root: resultsRef.value, rootMargin: '80px', threshold: 0.01 }
  );
  observer.observe(sentinelRef.value);
};

watch([hasMore, visibleHits, mode], async () => {
  if (mode.value !== 'classic') return;
  await nextTick();
  bindSentinel();
});

onMounted(() => {
  hydrate();
  document.addEventListener('pointerdown', onDocPointer);
  document.addEventListener('keydown', onDocKey);
  if (!alreadyRated()) {
    rateShowTimer = setTimeout(() => {
      rateVisible.value = true;
      rateReady.value = false;
      rateStep.value = 'stars';
      playRateVideo();
    }, 900);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  document.removeEventListener('pointerdown', onDocPointer);
  document.removeEventListener('keydown', onDocKey);
  if (rateHideTimer) clearTimeout(rateHideTimer);
  if (rateShowTimer) clearTimeout(rateShowTimer);
  stopRateSync();
});
</script>
