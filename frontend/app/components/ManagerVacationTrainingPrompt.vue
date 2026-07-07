<template>
  <div v-if="shouldShowPrompt" class="vac-training-prompt">
    <article class="vac-training-prompt__card">
      <p class="vac-training-prompt__eyebrow">Тренировочный полигон</p>
      <h4 class="vac-training-prompt__title">Обучение руководителя</h4>
      <p class="vac-training-prompt__text">
        Короткий квест по согласованию заявок и режимам календаря.
      </p>
      <button class="button primary vac-training-prompt__start" type="button" @click="startTraining">
        Начать квест
      </button>
      <button class="button ghost vac-training-prompt__skip" type="button" @click="skipTraining">
        Пропустить
      </button>
    </article>
  </div>
</template>

<script setup lang="ts">
const { shouldShowPrompt, startTraining, skipTraining } = useManagerVacationTraining();
</script>
