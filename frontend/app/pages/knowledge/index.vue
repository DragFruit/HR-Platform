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
      <div class="kb-modes" role="tablist" aria-label="Режим поиска">
        <button
          type="button"
          class="kb-mode"
          :class="{ 'is-on': mode === 'classic' }"
          role="tab"
          :aria-selected="mode === 'classic'"
          @click="setMode('classic')"
        >
          По базе
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
        <input
          v-model="draftQuery"
          type="text"
          class="kb-seek__input"
          placeholder="Найти по базе"
          autocomplete="off"
          aria-label="Найти по базе"
        />
        <button type="submit" class="kb-seek__go">Искать</button>
      </form>
      <form v-else class="kb-seek" @submit.prevent="onAiSubmit">
        <input
          v-model="aiDraft"
          type="text"
          class="kb-seek__input"
          placeholder="Спросить ИИ"
          autocomplete="off"
          aria-label="Спросить ИИ"
        />
        <button type="submit" class="kb-seek__go">Спросить</button>
      </form>

      <div v-if="mode === 'classic'" class="kb-filters" role="group" aria-label="Фильтры поиска">
        <div class="kb-field kb-field--date" :class="{ 'is-open': dateOpen }">
          <button
            type="button"
            class="kb-chip"
            :class="{ 'is-on': Boolean(draftFilters.dateFrom || draftFilters.dateTo) }"
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
          <select
            v-model="draftFilters.author"
            class="kb-chip kb-chip--select"
            :class="{ 'is-on': Boolean(draftFilters.author) }"
            aria-label="Автор"
          >
            <option value="">Автор · все</option>
            <option v-for="name in authors" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>
        <label class="kb-field">
          <select
            v-model="draftFilters.topic"
            class="kb-chip kb-chip--select"
            :class="{ 'is-on': Boolean(draftFilters.topic) }"
            aria-label="Тематика"
          >
            <option value="">Тематика · все</option>
            <option v-for="topic in topics" :key="topic" :value="topic">{{ topic }}</option>
          </select>
        </label>
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

const setMode = (next: SearchMode) => {
  if (next === mode.value) return;
  dateOpen.value = false;
  mode.value = next;
  if (next === 'ai') nextTick(() => scrollThread());
};

const toggleType = (value: 'regulation' | 'faq') => {
  draftFilters.value.type = draftFilters.value.type === value ? '' : value;
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
