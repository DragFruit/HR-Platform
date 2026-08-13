<template>
  <div class="kb-page kb-page--search" :data-mode="mode">
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
          <p v-if="!hits.length" class="kb-empty muted">Ничего не нашли — попробуй другой запрос или фильтр.</p>
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

    <div class="kb-console">
    <div v-if="mode === 'classic'" class="kb-filters" role="group" aria-label="Фильтры поиска">
      <div class="kb-field kb-field--date" :class="{ 'is-open': dateOpen }">
        <button
          type="button"
          class="kb-field__control kb-field__control--btn"
          :aria-expanded="dateOpen"
          aria-haspopup="dialog"
          @click="dateOpen = !dateOpen"
        >
          Дата · {{ dateLabel }}
        </button>
        <div v-if="dateOpen" class="kb-date-pop" role="dialog" aria-label="Период">
          <label>
            С
            <input v-model="draftFilters.dateFrom" type="date" />
          </label>
          <label>
            По
            <input v-model="draftFilters.dateTo" type="date" />
          </label>
          <button type="button" class="kb-date-pop__clear" @click="clearDate">Сбросить</button>
        </div>
      </div>
      <label class="kb-field">
        <select v-model="draftFilters.author" class="kb-field__control" aria-label="Автор">
          <option value="">Автор · все</option>
          <option v-for="name in authors" :key="name" :value="name">Автор · {{ name }}</option>
        </select>
      </label>
      <label class="kb-field">
        <select v-model="draftFilters.topic" class="kb-field__control" aria-label="Тематика">
          <option value="">Тематика · все</option>
          <option v-for="topic in topics" :key="topic" :value="topic">Тематика · {{ topic }}</option>
        </select>
      </label>
      <label class="kb-field">
        <select v-model="draftFilters.type" class="kb-field__control" aria-label="Тип">
          <option value="">Тип · все</option>
          <option value="regulation">Тип · регламент</option>
          <option value="faq">Тип · FAQ</option>
        </select>
      </label>
    </div>

    <div class="kb-dock" :class="{ 'kb-dock--swap': swapping }" :data-front="mode">
      <div
        class="kb-plate kb-plate--classic"
        :class="plateClass('classic')"
        @click="mode !== 'classic' && setMode('classic')"
      >
        <span class="kb-sq kb-sq--lime kb-sq--top-l" aria-hidden="true" />
        <span class="kb-sq kb-sq--purple kb-sq--top-r" aria-hidden="true" />
        <span class="kb-sq kb-sq--lime kb-sq--right-t" aria-hidden="true" />
        <span class="kb-sq kb-sq--purple kb-sq--right-b" aria-hidden="true" />
        <span class="kb-sq kb-sq--purple kb-sq--bot-l" aria-hidden="true" />
        <span class="kb-sq kb-sq--lime kb-sq--bot-r" aria-hidden="true" />
        <span class="kb-sq kb-sq--purple kb-sq--left-t" aria-hidden="true" />
        <span class="kb-sq kb-sq--lime kb-sq--left-b" aria-hidden="true" />
        <form v-if="mode === 'classic'" class="kb-plate__form" @submit.prevent="onClassicSubmit">
          <span class="kb-plate__mark" aria-hidden="true" />
          <input
            v-model="draftQuery"
            type="text"
            class="kb-plate__input"
            placeholder="Найти по базе…"
            autocomplete="off"
            aria-label="Найти по базе"
          />
        </form>
        <span v-else class="kb-plate__label">Найти по базе</span>
      </div>

      <div
        class="kb-plate kb-plate--ai"
        :class="plateClass('ai')"
        @click="mode !== 'ai' && setMode('ai')"
      >
        <span class="kb-sq kb-sq--lime kb-sq--top-l" aria-hidden="true" />
        <span class="kb-sq kb-sq--purple kb-sq--top-r" aria-hidden="true" />
        <span class="kb-sq kb-sq--lime kb-sq--right-t" aria-hidden="true" />
        <span class="kb-sq kb-sq--purple kb-sq--right-b" aria-hidden="true" />
        <span class="kb-sq kb-sq--purple kb-sq--bot-l" aria-hidden="true" />
        <span class="kb-sq kb-sq--lime kb-sq--bot-r" aria-hidden="true" />
        <span class="kb-sq kb-sq--purple kb-sq--left-t" aria-hidden="true" />
        <span class="kb-sq kb-sq--lime kb-sq--left-b" aria-hidden="true" />
        <form v-if="mode === 'ai'" class="kb-plate__form" @submit.prevent="onAiSubmit">
          <span class="kb-plate__mark kb-plate__mark--ai" aria-hidden="true" />
          <input
            v-model="aiDraft"
            type="text"
            class="kb-plate__input"
            placeholder="Спросить ИИ"
            autocomplete="off"
            aria-label="Спросить ИИ"
          />
        </form>
        <span v-else class="kb-plate__label">Спросить ИИ</span>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { knowledgeAuthors, knowledgeCategories } from '~/data/knowledgeBaseCatalog';

type SearchMode = 'classic' | 'ai';

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

const mode = ref<SearchMode>('classic');
const swapping = ref(false);
const dateOpen = ref(false);
const aiDraft = ref('');
const resultsRef = ref<HTMLElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);
const threadRef = ref<HTMLElement | null>(null);

const authors = knowledgeAuthors();
const topics = knowledgeCategories();

const formatDateShort = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!d || !m) return iso;
  return `${d}.${m}`;
};

const dateLabel = computed(() => {
  const from = formatDateShort(draftFilters.value.dateFrom);
  const to = formatDateShort(draftFilters.value.dateTo);
  if (from && to) return `${from}–${to}`;
  if (from) return `с ${from}`;
  if (to) return `до ${to}`;
  return 'все';
});

const clearDate = () => {
  draftFilters.value.dateFrom = '';
  draftFilters.value.dateTo = '';
};

const onDocPointer = (event: PointerEvent) => {
  const target = event.target as Node | null;
  const host = document.querySelector('.kb-field--date');
  if (host && target && !host.contains(target)) dateOpen.value = false;
};

const plateClass = (plate: SearchMode) => ({
  'kb-plate--front': mode.value === plate,
  'kb-plate--back': mode.value !== plate
});

const setMode = (next: SearchMode) => {
  if (next === mode.value || swapping.value) return;
  dateOpen.value = false;
  swapping.value = true;
  mode.value = next;
  window.setTimeout(() => {
    swapping.value = false;
    if (next === 'ai') scrollThread();
  }, 460);
};

const onClassicSubmit = () => {
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
});

onBeforeUnmount(() => {
  observer?.disconnect();
  document.removeEventListener('pointerdown', onDocPointer);
});
</script>
