<template>
  <form v-if="!submitted" class="adaptation-quiz hr-knowledge-quiz" @submit.prevent="submit">
    <h4 class="section-title">Тест на оценку HR-знаний</h4>
    <p class="muted">
      {{ totalQuestions }} ситуационных вопросов в {{ blocks.length }} блоках компетенций — под контекст digital-агентства VBI
      (~69 человек, Москва + удалёнка по России). Результаты попадут в матрицу оценки.
    </p>

    <section v-for="block in blocks" :key="block.competencyId" class="hr-quiz-block">
      <h5 class="hr-quiz-block__title">{{ block.title }}</h5>

      <fieldset
        v-for="question in block.questions"
        :key="question.id"
        class="quiz-question"
      >
        <legend>{{ question.text }}</legend>
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
      </fieldset>
    </section>

    <p v-if="error" class="gift-error">{{ error }}</p>

    <div class="hero-actions">
      <button class="button primary" type="submit" :disabled="submitting">
        {{ submitting ? 'Подсчёт…' : 'Отправить ответы' }}
      </button>
      <button class="button ghost" type="button" @click="emit('cancel')">Отмена</button>
    </div>
  </form>

  <article v-else class="card quiz-result passed">
    <h4>Тест завершён</h4>
    <p class="stat-value">{{ submitted.overallPercent }}%</p>
    <p class="muted">Результаты по блокам сохранены и отображены в матрице компетенций.</p>

    <ul class="list-reset hr-quiz-summary">
      <li v-for="block in blocks" :key="block.competencyId" class="hr-quiz-summary__row">
        <span>{{ block.title }}</span>
        <strong>{{ submitted.blockScores[block.competencyId]?.percent ?? 0 }}%</strong>
      </li>
    </ul>

    <div class="hero-actions">
      <NuxtLink to="/profile/assessment" class="button primary">К матрице</NuxtLink>
      <button class="button ghost" type="button" @click="emit('done')">Закрыть</button>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { HrTestResult } from '~/composables/useHrKnowledgeTest';

const props = defineProps<{
  taskId?: number;
}>();

const emit = defineEmits<{
  cancel: [];
  done: [result: HrTestResult];
}>();

const { blocks, submitAnswers } = useHrKnowledgeTest();
const { completeTask, HR_KNOWLEDGE_TASK_ID, tasks } = useTasks();

const answers = ref<Record<string, string>>({});
const submitting = ref(false);
const error = ref('');
const submitted = ref<HrTestResult | null>(null);

const totalQuestions = computed(() =>
  blocks.reduce((sum, block) => sum + block.questions.length, 0)
);

const submit = () => {
  error.value = '';
  submitting.value = true;

  try {
    const taskId = props.taskId ?? HR_KNOWLEDGE_TASK_ID;
    const result = submitAnswers(answers.value, taskId);
    const task = tasks.value.find((t) => t.id === taskId);
    if (task?.status === 'active') {
      completeTask(taskId);
    }
    submitted.value = result;
    emit('done', result);
  } catch {
    error.value = 'Не удалось сохранить результат. Попробуйте ещё раз.';
  } finally {
    submitting.value = false;
  }
};
</script>
