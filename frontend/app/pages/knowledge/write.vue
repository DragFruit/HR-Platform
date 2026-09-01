<template>
  <div class="kb-write-page">
    <NuxtLink to="/knowledge" class="kb-article__back">← К базе знаний</NuxtLink>
    <h1 class="kb-write-page__title">Статьи в базу знаний</h1>
    <KnowledgeArticleWorkspace />
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Написать статью — База знаний' });
</script>

<style scoped>
.kb-write-page {
  display: grid;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding-bottom: 24px;
}

.kb-write-page__title {
  margin: 0;
  font-family: Unbounded, sans-serif;
  font-size: 1.15rem;
  font-weight: 800;
}
</style>
