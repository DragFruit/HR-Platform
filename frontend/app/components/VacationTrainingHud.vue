<template>
  <div v-if="isActive" class="vac-training-hud" role="status">
    <span class="vac-training-hud__label">{{ progressLabel }}</span>
    <span v-if="currentStep" class="vac-training-hud__step">{{ currentStep.title }}</span>
    <span class="vac-training-hud__badge">Учебный режим</span>
  </div>
</template>

<script setup lang="ts">
const { isActive, currentStep, progressLabel } = useVacationTraining();
</script>
