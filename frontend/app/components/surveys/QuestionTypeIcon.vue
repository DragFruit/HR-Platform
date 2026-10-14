<template>
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
    <template v-if="type === 'info'">
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" stroke-width="1.4" />
      <circle cx="10" cy="6.6" r="0.9" fill="currentColor" />
      <path d="M10 9.4v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </template>
    <template v-else-if="type === 'single'">
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" stroke-width="1.4" />
      <circle cx="10" cy="10" r="2.9" fill="currentColor" />
    </template>
    <template v-else-if="type === 'multi'">
      <rect x="3.25" y="3.25" width="13.5" height="13.5" rx="3" stroke="currentColor" stroke-width="1.4" />
      <path d="M6.5 10.2l2.2 2.2 4.8-4.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="type === 'yesno'">
      <rect x="2.5" y="6.5" width="15" height="7" rx="3.5" stroke="currentColor" stroke-width="1.4" />
      <circle cx="13.5" cy="10" r="2.1" fill="currentColor" />
    </template>
    <template v-else-if="type === 'smiley'">
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" stroke-width="1.4" />
      <circle cx="7.4" cy="8.4" r="0.9" fill="currentColor" />
      <circle cx="12.6" cy="8.4" r="0.9" fill="currentColor" />
      <path d="M6.9 12c.7 1.1 1.9 1.8 3.1 1.8s2.4-.7 3.1-1.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </template>
    <template v-else-if="type === 'nps'">
      <path d="M3 13.5a7 7 0 0 1 14 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      <path d="M10 13.5 13 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="10" cy="13.5" r="1" fill="currentColor" />
    </template>
    <template v-else-if="type === 'scale'">
      <path d="M3 10h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="12.5" cy="10" r="2.6" fill="currentColor" />
    </template>
    <template v-else-if="type === 'text_short'">
      <path d="M3.5 7.5h13M3.5 10h8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </template>
    <template v-else>
      <path d="M3.5 6.5h13M3.5 10h13M3.5 13.5h8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import type { SurveyQuestionType } from '~/composables/useSurveys';

defineProps<{ type: SurveyQuestionType }>();
</script>
