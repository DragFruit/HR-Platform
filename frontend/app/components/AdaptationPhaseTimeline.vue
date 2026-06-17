<template>
  <div class="adaptation-phases">
    <article
      v-for="phase in phases"
      :key="phase.id"
      class="card section-card phase-card"
      :class="{ locked: !phase.unlocked, overdue: phase.overdue }"
    >
      <div class="section-head row">
        <div>
          <h3 class="section-title">{{ phase.title }}</h3>
          <p class="muted">{{ phase.description }}</p>
          <p class="soft">
            Дни {{ phase.due_day_from }}–{{ phase.due_day_to }}
            <span v-if="daysSinceHire != null"> · у вас день {{ daysSinceHire }}</span>
          </p>
        </div>
        <span v-if="phase.quiz_passed" class="status-chip done">Тест сдан</span>
        <span v-else-if="!phase.unlocked" class="status-chip pending">Скоро</span>
        <span v-else-if="phase.overdue" class="status-chip active">Просрочено</span>
        <span v-else class="status-chip active">Активно</span>
      </div>

      <ul class="timeline list-reset">
        <li
          v-for="step in phase.steps"
          :key="step.id"
          class="timeline-item"
          :class="step.completed ? 'done' : 'active'"
        >
          <div class="timeline-dot" />
          <div>
            <strong>{{ step.title }}</strong>
            <p class="muted">День {{ step.due_day }} · {{ ownerLabels[step.owner] ?? step.owner }}</p>
          </div>
          <button
            v-if="!step.completed && phase.unlocked"
            class="button ghost"
            type="button"
            @click="emit('complete-step', step.id)"
          >
            Готово
          </button>
          <span v-else-if="step.completed" class="status-chip done">✓</span>
        </li>
      </ul>

      <div v-if="phase.quiz && phase.unlocked" class="quiz-cta">
        <p v-if="phase.quiz_passed" class="muted">
          Последний результат: {{ phase.quiz_score }}%
        </p>
        <button class="button primary" type="button" @click="emit('start-quiz', phase.quiz!)">
          {{ phase.quiz_passed ? 'Пересдать тест' : 'Пройти тест' }}
        </button>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import type { AdaptationPhaseClient, AdaptationQuizClient } from '~/composables/useAdaptation';

defineProps<{
  phases: AdaptationPhaseClient[];
  daysSinceHire: number | null;
}>();

const emit = defineEmits<{
  'start-quiz': [quiz: AdaptationQuizClient];
  'complete-step': [stepId: string];
}>();

const ownerLabels: Record<string, string> = {
  employee: 'Сотрудник',
  manager: 'Руководитель',
  buddy: 'Buddy',
  hr: 'HR'
};
</script>
