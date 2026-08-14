<template>
  <div class="kb-page kb-page--search" :data-mode="mode">
    <KnowledgeRateCat />

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
          />
          <KnowledgeSearchGhost v-if="!draftQuery" />
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

/** Фильтры спрятаны, код не удалять — вернуть `true`, если снова нужны. */
const KB_FILTERS_ENABLED = false;

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
  document.addEventListener('keydown', onDocKey);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  document.removeEventListener('pointerdown', onDocPointer);
  document.removeEventListener('keydown', onDocKey);
});
</script>
