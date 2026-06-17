<template>
  <form v-if="!result" class="adaptation-quiz" @submit.prevent="submit">
    <h4 class="section-title">{{ quiz.title }}</h4>
    <p class="muted">Проходной балл: {{ quiz.passing_score }}%</p>

    <fieldset
      v-for="question in quiz.questions"
      :key="question.id"
      class="quiz-question"
    >
      <legend>{{ question.text }}</legend>

      <template v-if="question.type === 'single'">
        <label v-for="opt in question.options" :key="opt.id" class="quiz-option">
          <input
            v-model="answers[question.id]"
            type="radio"
            :name="question.id"
            :value="opt.id"
            required
          />
          <span>{{ opt.label }}</span>
        </label>
      </template>

      <template v-else-if="question.type === 'multi'">
        <label v-for="opt in question.options" :key="opt.id" class="quiz-option">
          <input
            v-model="multiAnswers[question.id]"
            type="checkbox"
            :value="opt.id"
          />
          <span>{{ opt.label }}</span>
        </label>
      </template>

      <template v-else-if="question.type === 'scale'">
        <div class="scale-row">
          <input
            v-model.number="answers[question.id]"
            type="range"
            :min="question.scale_min ?? 1"
            :max="question.scale_max ?? 5"
            step="1"
            required
          />
          <span class="scale-value">{{ answers[question.id] ?? question.scale_min ?? 1 }}</span>
        </div>
      </template>
    </fieldset>

    <p v-if="error" class="gift-error">{{ error }}</p>

    <div class="hero-actions">
      <button class="button primary" type="submit" :disabled="submitting">
        {{ submitting ? 'Отправка...' : 'Отправить ответы' }}
      </button>
      <button class="button ghost" type="button" @click="emit('cancel')">Отмена</button>
    </div>
  </form>

  <article v-if="result" class="card quiz-result" :class="{ passed: result.passed }">
    <h4>{{ result.passed ? 'Тест пройден' : 'Тест не пройден' }}</h4>
    <p class="stat-value">{{ result.score_percent }}%</p>
    <p class="muted">
      Результат сохранён и отправлен администратору HR ({{ result.attempt.employee_name }}).
    </p>
    <button class="button primary" type="button" @click="emit('done')">Закрыть</button>
  </article>
</template>

<script setup lang="ts">
import type { AdaptationAnswer, AdaptationAttemptRecord, AdaptationQuizClient } from '~/composables/useAdaptation';

const props = defineProps<{
  quiz: AdaptationQuizClient;
}>();

const emit = defineEmits<{
  cancel: [];
  done: [];
}>();

const { submitAttempt } = useAdaptation();

const answers = ref<Record<string, string | number>>({});
const multiAnswers = ref<Record<string, string[]>>({});
const submitting = ref(false);
const error = ref('');
const result = ref<{
  passed: boolean;
  score_percent: number;
  attempt: AdaptationAttemptRecord;
} | null>(null);

props.quiz.questions.forEach((q) => {
  if (q.type === 'multi') multiAnswers.value[q.id] = [];
  if (q.type === 'scale') answers.value[q.id] = q.scale_min ?? 1;
});

const buildAnswers = (): AdaptationAnswer[] =>
  props.quiz.questions.map((q) => {
    if (q.type === 'multi') {
      return { question_id: q.id, value: [...(multiAnswers.value[q.id] ?? [])].sort() };
    }
    return { question_id: q.id, value: answers.value[q.id] ?? '' };
  });

const submit = async () => {
  error.value = '';
  submitting.value = true;
  try {
    const res = await submitAttempt(props.quiz.id, buildAnswers());
    result.value = {
      passed: res.passed,
      score_percent: res.score_percent,
      attempt: res.attempt
    };
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string };
    error.value = err.data?.statusMessage ?? err.message ?? 'Не удалось отправить';
  } finally {
    submitting.value = false;
  }
};
</script>
