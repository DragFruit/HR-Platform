<template>
  <section class="card">
    <div class="row">
      <h2 class="section-title">Задачи</h2>
      <button class="button ghost" type="button" @click="reload">Обновить</button>
    </div>
    <p class="muted">
      Возьми задачу из общего списка — она появится в твоих активных. Здесь же видны завершённые и отменённые.
    </p>
  </section>

  <section v-if="loading" class="grid-two">
    <article v-for="item in 4" :key="item" class="card">
      <div class="skeleton" style="height: 22px; margin-bottom: 10px;" />
      <div class="skeleton" style="height: 16px; margin-bottom: 8px;" />
      <div class="skeleton" style="height: 36px;" />
    </article>
  </section>

  <template v-else-if="error">
    <section class="card state-box">
      <h3>Не удалось загрузить задачи</h3>
      <p>Проверь соединение с API и попробуй снова.</p>
      <button class="button primary" type="button" @click="reload">Повторить</button>
    </section>
  </template>

  <template v-else>
    <section class="card">
      <div class="row">
        <h3 class="section-title">Общий список задач</h3>
        <span class="soft">{{ filteredPool.length }} доступно</span>
      </div>

      <div class="filters">
        <button
          v-for="filter in motivationFilters"
          :key="filter.value"
          class="filter-btn"
          type="button"
          :class="{ active: poolFilter === filter.value }"
          @click="poolFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>

      <div v-if="filteredPool.length === 0" class="state-box compact-state">
        <p class="muted">В общем списке сейчас нет задач. Попробуй другой фильтр или зайди позже.</p>
      </div>

      <div v-else class="grid-two tasks-grid">
        <article v-for="task in filteredPool" :key="task.id" class="card task-item">
          <div class="row">
            <strong>{{ task.title }}</strong>
            <span class="tag" :class="task.motivation_block">{{ motivationLabels[task.motivation_block] }}</span>
          </div>
          <p class="muted">
            {{ difficultyLabels[task.difficulty] }} · Дедлайн: {{ formatDate(task.deadline) }}
          </p>
          <div class="row">
            <span class="pill">+{{ task.reward_amount }}</span>
            <button
              v-if="isHrKnowledgeTask(task)"
              class="button primary"
              type="button"
              @click="handleTakeQuiz(task.id)"
            >
              Взять и пройти
            </button>
            <button v-else class="button primary" type="button" @click="handleTake(task.id)">
              Взять задачу
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="card">
      <div class="row">
        <h3 class="section-title">Мои задачи</h3>
        <span class="soft">{{ filteredMine.length }}</span>
      </div>

      <div class="filters">
        <button
          v-for="filter in statusFilters"
          :key="filter.value"
          class="filter-btn"
          type="button"
          :class="{ active: myStatusFilter === filter.value }"
          @click="myStatusFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>

      <div v-if="filteredMine.length === 0" class="state-box compact-state">
        <p class="muted">
          {{
            myStatusFilter === 'all'
              ? 'У тебя пока нет задач. Возьми что-нибудь из общего списка выше.'
              : 'В этом статусе задач пока нет.'
          }}
        </p>
      </div>

      <div v-else class="grid-two tasks-grid">
        <article v-for="task in filteredMine" :key="task.id" class="card task-item">
          <div class="row">
            <strong>{{ task.title }}</strong>
            <span class="tag status-tag" :class="`status-${task.status}`">
              {{ taskStatusLabels[task.status] }}
            </span>
          </div>
          <p class="muted">
            {{ motivationLabels[task.motivation_block] }} · {{ difficultyLabels[task.difficulty] }} · Дедлайн:
            {{ formatDate(task.deadline) }}
          </p>
          <p v-if="task.taken_at" class="soft">Взята: {{ formatDate(task.taken_at) }}</p>
          <p v-if="task.completed_at" class="soft">Завершена: {{ formatDate(task.completed_at) }}</p>
          <div class="row">
            <span class="pill">+{{ task.reward_amount }}</span>
            <button
              v-if="isHrKnowledgeTask(task)"
              class="button primary"
              type="button"
              @click="openHrAssessment(task.id)"
            >
              {{ task.status === 'completed' ? 'Пройти снова' : 'Пройти тест' }}
            </button>
            <button
              v-else-if="task.status === 'active'"
              class="button primary"
              type="button"
              @click="handleComplete(task.id)"
            >
              Завершить
            </button>
          </div>
        </article>
      </div>
    </section>
  </template>
</template>

<script setup lang="ts">
import type { MotivationBlock } from '~/composables/useMockData';
import type { TaskStatus } from '~/composables/useTasks';

const {
  poolTasks,
  myTasks,
  hydrate,
  takeTask,
  completeTask,
  filterByMotivation,
  filterByStatus,
  isHrKnowledgeTask,
  taskStatusLabels,
  motivationLabels,
  difficultyLabels
} = useTasks();

const poolFilter = ref<'all' | MotivationBlock>('all');
const myStatusFilter = ref<'all' | TaskStatus>('all');
const loading = ref(true);
const error = ref(false);

const motivationFilters = [
  { value: 'all', label: 'Все' },
  { value: 'personal_brand', label: 'Личный бренд' },
  { value: 'more_money', label: 'Деньги' },
  { value: 'more_free_time', label: 'Свободное время' },
  { value: 'new_interesting', label: 'Новое' },
  { value: 'learning', label: 'Обучение' }
] as const;

const statusFilters = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'completed', label: 'Завершённые' },
  { value: 'cancelled', label: 'Отменённые' }
] as const;

const filteredPool = computed(() => filterByMotivation(poolTasks.value, poolFilter.value));

const filteredMine = computed(() => filterByStatus(myTasks.value, myStatusFilter.value));

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

const openHrAssessment = async (taskId: number) => {
  await navigateTo(`/tasks/hr-assessment?taskId=${taskId}`);
};

const handleTake = (taskId: number) => {
  takeTask(taskId);
};

const handleTakeQuiz = async (taskId: number) => {
  takeTask(taskId);
  await openHrAssessment(taskId);
};

const handleComplete = (taskId: number) => {
  completeTask(taskId);
};

const reload = () => {
  loading.value = true;
  error.value = false;

  setTimeout(() => {
    hydrate();
    loading.value = false;
  }, 400);
};

onMounted(reload);
</script>
