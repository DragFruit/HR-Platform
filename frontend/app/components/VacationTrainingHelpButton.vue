<template>
  <button
    v-if="shouldShowHelpButton"
    type="button"
    class="vac-training-help-btn"
    :aria-label="helpLabel"
    :title="helpLabel"
    @click="restartTraining"
  >
    ?
  </button>
</template>

<script setup lang="ts">
const { shouldShowHelpButton, isCompletedForCurrentUser, restartTraining } = useVacationTraining();

const helpLabel = computed(() =>
  isCompletedForCurrentUser.value ? 'Повторить обучение' : 'Пройти обучение'
);
</script>
