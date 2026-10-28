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

      <div v-else class="tcard-grid">
        <article v-for="task in filteredPool" :key="task.id" class="tcard">
          <div class="tcard__body">
            <h4 class="tcard__title">{{ task.title }}</h4>
            <ul class="tcard__pills">
              <li class="tcard__pill tcard__pill--reward">+{{ task.reward_amount }}</li>
              <li class="tcard__pill">{{ motivationLabels[task.motivation_block] }}</li>
              <li class="tcard__pill">{{ difficultyLabels[task.difficulty] }}</li>
              <li class="tcard__pill">до {{ formatDate(task.deadline) }}</li>
            </ul>
          </div>
          <button
            class="tcard__go"
            type="button"
            :aria-label="isHrKnowledgeTask(task) ? 'Взять и пройти' : 'Взять задачу'"
            :title="isHrKnowledgeTask(task) ? 'Взять и пройти' : 'Взять задачу'"
            @click="isHrKnowledgeTask(task) ? handleTakeQuiz(task.id) : handleTake(task.id)"
          >
            <span aria-hidden="true">↗</span>
          </button>
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

      <div v-else class="tcard-grid">
        <article
          v-for="task in filteredMine"
          :key="task.id"
          class="tcard"
          :class="{ 'tcard--plain': !myTaskAction(task) }"
        >
          <div class="tcard__body">
            <h4 class="tcard__title">{{ task.title }}</h4>
            <ul class="tcard__pills">
              <li class="tcard__pill tcard__pill--status" :class="`status-${task.status}`">
                {{ taskStatusLabels[task.status] }}
              </li>
              <li class="tcard__pill tcard__pill--reward">+{{ task.reward_amount }}</li>
              <li class="tcard__pill">{{ motivationLabels[task.motivation_block] }}</li>
              <li class="tcard__pill">{{ difficultyLabels[task.difficulty] }}</li>
              <li class="tcard__pill">до {{ formatDate(task.deadline) }}</li>
              <li v-if="task.taken_at" class="tcard__pill">Взята {{ formatDate(task.taken_at) }}</li>
              <li v-if="task.completed_at" class="tcard__pill">Завершена {{ formatDate(task.completed_at) }}</li>
            </ul>
          </div>
          <button
            v-if="myTaskAction(task)"
            class="tcard__go"
            type="button"
            :aria-label="myTaskAction(task)!.label"
            :title="myTaskAction(task)!.label"
            @click="myTaskAction(task)!.run()"
          >
            <span aria-hidden="true">↗</span>
          </button>
        </article>
      </div>
    </section>
  </template>
</template>

<script setup lang="ts">
import type { MotivationBlock } from '~/composables/useMockData';
import type { Task, TaskStatus } from '~/composables/useTasks';

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


/** Главное действие карточки «Мои задачи» (оранжевая стрелка); null — действия нет. */
const myTaskAction = (task: Task) => {
  if (isHrKnowledgeTask(task)) {
    return {
      label: task.status === 'completed' ? 'Пройти снова' : 'Пройти тест',
      run: () => openHrAssessment(task.id)
    };
  }
  if (task.status === 'active') {
    return { label: 'Завершить', run: () => handleComplete(task.id) };
  }
  return null;
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

<style scoped>
.tcard-grid {
  display: grid;
  /* 3 колонки на широком контенте, 2 на среднем, 1 на мобиле. */
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 12px;
  padding: 12px;
  border-radius: 24px;
  background: var(--hero-purple);
}

.tcard {
  position: relative;
  transition: transform 0.2s ease;
}

.tcard:hover {
  transform: translateY(-3px);
}

.tcard__body {
  height: 100%;
  padding: 16px;
  border-radius: 24px;
  background: var(--bg-surface);
  /* Вогнутый вырез в правом верхнем углу под кнопку-стрелку: фон под карточкой просвечивает. */
  -webkit-mask: radial-gradient(circle 30px at calc(100% - 22px) 22px, transparent 29.5px, #000 30px);
  mask: radial-gradient(circle 30px at calc(100% - 22px) 22px, transparent 29.5px, #000 30px);
}

.tcard--plain .tcard__body {
  -webkit-mask: none;
  mask: none;
}

.tcard__title {
  margin: 0 48px 12px 0;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--accent-orange);
  overflow-wrap: anywhere;
}

.tcard--plain .tcard__title {
  margin-right: 0;
}

.tcard__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tcard__pill {
  padding: 6px 12px;
  border-radius: 999px;
  background: #eee9fb;
  color: var(--text);
  font-size: 13px;
  line-height: 1.2;
}

.tcard__pill--reward {
  font-weight: 700;
}

.tcard__pill--status.status-active {
  background: var(--accent-lime);
}

.tcard__pill--status.status-completed {
  background: var(--mint);
}

.tcard__pill--status.status-cancelled {
  background: var(--bg-soft);
  color: var(--text-muted);
}

.tcard__go {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--accent-orange);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.tcard__go:hover {
  transform: rotate(12deg) scale(1.08);
}

.tcard__go:focus-visible {
  outline: 3px solid var(--accent-lime);
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .tcard-grid {
    grid-template-columns: 1fr;
    padding: 8px;
    gap: 8px;
    border-radius: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tcard,
  .tcard__go {
    transition: none;
  }

  .tcard:hover,
  .tcard__go:hover {
    transform: none;
  }
}
</style>
