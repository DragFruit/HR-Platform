<template>
  <div class="kb-page">
    <KnowledgeFolderClip />

    <div class="kb-toolbar">
      <label class="kb-search">
        <span class="sr-only">Поиск</span>
        <input
          v-model.trim="query"
          type="search"
          class="kb-search__input"
          placeholder="Поиск по материалам…"
          autocomplete="off"
          aria-label="Поиск по материалам"
        />
      </label>

      <div class="kb-filters" role="group" aria-label="Категория">
        <button
          type="button"
          class="kb-filter"
          :class="{ 'kb-filter--active': category === 'all' }"
          @click="category = 'all'"
        >
          Все
        </button>
        <button
          v-for="cat in categories"
          :key="cat"
          type="button"
          class="kb-filter"
          :class="{ 'kb-filter--active': category === cat }"
          @click="category = cat"
        >
          {{ cat }}
        </button>
      </div>
    </div>

    <div v-if="visibleCards.length" class="kb-grid" role="list">
      <template v-for="card in visibleCards" :key="card.id">
        <NuxtLink
          v-if="card.tone !== 'placeholder'"
          :to="`/knowledge/${card.id}`"
          class="kb-card-wrap"
          role="listitem"
        >
          <KbCardFace :card="card" />
        </NuxtLink>
        <article v-else class="kb-card-wrap kb-card-wrap--placeholder" role="listitem">
          <KbCardFace :card="card" />
        </article>
      </template>
    </div>

    <p v-else class="kb-empty muted">Ничего не нашли — попробуй другой запрос или фильтр.</p>
  </div>
</template>

<script setup lang="ts">
import {
  knowledgeBaseCards,
  knowledgeCategories,
  type KnowledgeCard
} from '~/data/knowledgeBaseCatalog';

const query = ref('');
const category = ref('all');
const categories = knowledgeCategories();

const matchesQuery = (card: KnowledgeCard, q: string) => {
  if (!q) return true;
  const hay = [card.title, card.description, card.category, card.author ?? '']
    .join(' ')
    .toLowerCase();
  return hay.includes(q.toLowerCase());
};

const visibleCards = computed(() => {
  const q = query.value;
  return knowledgeBaseCards.filter((card) => {
    if (card.tone === 'placeholder') {
      return category.value === 'all' && !q;
    }
    if (category.value !== 'all' && card.category !== category.value) return false;
    return matchesQuery(card, q);
  });
});
</script>
