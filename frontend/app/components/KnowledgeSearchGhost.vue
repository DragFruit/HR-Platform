<script setup lang="ts">
import { KNOWLEDGE_SEARCH_PHRASES } from '~/data/knowledgeSearchPhrases';

const { text } = useKnowledgePlaceholder(KNOWLEDGE_SEARCH_PHRASES);
</script>

<template>
  <span class="kb-seek__ghost" aria-hidden="true">
    Например: {{ text }}<i class="kb-seek__caret" />
  </span>
</template>
