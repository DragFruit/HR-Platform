<template>
  <span class="competency-level-badge" :class="[`level-${level}`, { emphasis }]">
    <span v-for="dot in 4" :key="dot" class="competency-level-badge__dot" :class="{ filled: dot <= level }" />
    <span class="competency-level-badge__label">{{ competencyLevelLabels[level] }}</span>
  </span>
</template>

<script setup lang="ts">
import type { CompetencyLevel } from '~/composables/useHrDevelopment';
import { competencyLevelLabels } from '~/composables/useHrDevelopment';

defineProps<{
  level: CompetencyLevel;
  emphasis?: boolean;
}>();
</script>
