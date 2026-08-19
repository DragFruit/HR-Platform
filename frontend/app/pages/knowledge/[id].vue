<template>
  <div v-if="!card" class="kb-article kb-article--missing">
    <p class="muted">Материал не найден.</p>
    <NuxtLink to="/knowledge" class="button ghost">К базе знаний</NuxtLink>
  </div>

  <article v-else class="kb-article">
    <NuxtLink to="/knowledge" class="kb-article__back">← Все материалы</NuxtLink>

    <header class="kb-article__head">
      <nav v-if="card.breadcrumbs?.length" class="kb-article__crumbs">
        <template v-for="(crumb, i) in card.breadcrumbs" :key="i">
          <span class="kb-article__crumb">{{ crumb }}</span>
          <span v-if="i < card.breadcrumbs.length - 1" class="kb-article__crumb-sep">/</span>
        </template>
      </nav>
      <span v-else-if="card.category" class="kb-article__badge">{{ card.category }}</span>
      <h2 class="kb-article__title">{{ card.title }}</h2>
      <p v-if="card.author || card.publishedAt" class="kb-article__meta muted">
        <span v-if="card.author">{{ card.author }}</span>
        <span v-if="card.author && card.publishedAt"> · </span>
        <span v-if="card.publishedAt">{{ card.publishedAt }}</span>
      </p>
    </header>

    <div v-if="card.bodyHtml" class="kb-prose" v-html="card.bodyHtml" />

    <div v-else class="kb-prose">
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
