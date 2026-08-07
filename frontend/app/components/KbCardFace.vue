<template>
  <div
    class="kb-card"
    :class="[`kb-card--${card.tone}`, { 'kb-card--placeholder': card.tone === 'placeholder' }]"
  >
    <div class="kb-card__shine" aria-hidden="true" />
    <div class="kb-card__pattern" aria-hidden="true" />

    <span v-if="card.category" class="kb-card__badge">{{ card.category }}</span>

    <h3 class="kb-card__title">{{ card.title }}</h3>

    <template v-if="card.tone === 'doc' && card.previewItems?.length">
      <ol class="kb-card__preview list-reset">
        <li v-for="(item, idx) in card.previewItems" :key="`${card.id}-${idx}`">
          <span class="kb-card__preview-num">{{ String(idx + 1).padStart(2, '0') }}</span>
          {{ item }}
        </li>
      </ol>
    </template>
    <p v-else class="kb-card__desc">{{ card.description }}</p>

    <div class="kb-card__foot">
      <div class="kb-card__foot-left">
        <span v-if="card.author" class="kb-card__author">Автор: {{ card.author }}</span>
        <span class="kb-card__brand">VBI</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { KnowledgeCard } from '~/data/knowledgeBaseCatalog';

defineProps<{ card: KnowledgeCard }>();
</script>
