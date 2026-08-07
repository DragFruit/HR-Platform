<template>
  <div v-if="!card" class="kb-article kb-article--missing">
    <p class="muted">Материал не найден.</p>
    <NuxtLink to="/knowledge" class="button ghost">К базе знаний</NuxtLink>
  </div>

  <article v-else class="kb-article">
    <NuxtLink to="/knowledge" class="kb-article__back">← Все материалы</NuxtLink>

    <header class="kb-article__head">
      <span v-if="card.category" class="kb-article__badge">{{ card.category }}</span>
      <h2 class="kb-article__title">{{ card.title }}</h2>
      <p v-if="card.author" class="kb-article__meta muted">Автор: {{ card.author }}</p>
    </header>

    <div class="kb-article__body">
      <p v-for="(paragraph, idx) in card.body ?? [card.description]" :key="idx">
        {{ paragraph }}
      </p>
    </div>
  </article>
</template>

<script setup lang="ts">
import { findKnowledgeCard } from '~/data/knowledgeBaseCatalog';

const route = useRoute();
const id = computed(() => String(route.params.id ?? ''));
const card = computed(() => findKnowledgeCard(id.value));
</script>
