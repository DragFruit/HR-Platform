<template>
  <button
    v-if="shouldShowHelpButton"
    type="button"
    class="vac-training-help-btn"
    aria-label="Повторить обучение по графику отпусков"
    title="Повторить обучение"
    @click="restartTraining"
  >
    ?
  </button>
</template>

<script setup lang="ts">
const { shouldShowHelpButton, restartTraining } = useVacationTraining();
</script>
