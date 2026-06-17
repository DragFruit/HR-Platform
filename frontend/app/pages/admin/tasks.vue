<template>
  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h2 class="section-title">Задачи для сотрудников</h2>
        <p class="muted">
          Создайте задачи в общий пул. Сотрудники берут их в работу; за завершение начисляется валюта на кошелёк.
        </p>
      </div>
    </div>

    <form class="card task-create-form" @submit.prevent="submit">
      <h3 class="section-title">Новая задача</h3>
      <div class="grid-two">
        <label class="gift-field">
          <span>Название</span>
          <input v-model="form.title" class="org-input" required placeholder="Например: Онбординг в Confluence" />
        </label>
        <label class="gift-field">
          <span>Дедлайн</span>
          <input v-model="form.deadline" type="date" class="org-input" required />
        </label>
        <label class="gift-field">
          <span>Мотивация</span>
          <select v-model="form.motivation_block" class="org-input">
            <option v-for="(label, key) in motivationLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="gift-field">
          <span>Сложность</span>
          <select v-model="form.difficulty" class="org-input">
            <option value="easy">Лёгкая</option>
            <option value="medium">Средняя</option>
            <option value="hard">Сложная</option>
          </select>
        </label>
        <label class="gift-field">
          <span>Награда (валюта)</span>
          <input v-model.number="form.reward_amount" type="number" min="1" class="org-input" required />
        </label>
      </div>
      <button class="button primary" type="submit">Добавить в общий пул</button>
      <p v-if="message" class="gift-success">{{ message }}</p>
    </form>
  </section>

  <section class="card section-card">
    <h3 class="section-title">Все задачи ({{ tasks.length }})</h3>
    <p v-if="tasks.length === 0" class="muted state-box">Пока нет задач. Создайте первую выше.</p>
    <ul v-else class="list-reset">
      <li v-for="task in tasks" :key="task.id" class="task-item">
        <strong>{{ task.title }}</strong>
        <span class="status-chip" :class="task.status">{{ taskStatusLabels[task.status] }}</span>
        <p class="muted">
          +{{ task.reward_amount }} · {{ motivationLabels[task.motivation_block] }} · до {{ task.deadline }}
        </p>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { MotivationBlock } from '~/composables/useMockData';

const { tasks, addTask, hydrate, taskStatusLabels, motivationLabels } = useTasks();

const form = ref({
  title: '',
  motivation_block: 'learning' as MotivationBlock,
  reward_amount: 100,
  deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  difficulty: 'medium' as 'easy' | 'medium' | 'hard'
});

const message = ref('');

const submit = () => {
  addTask(form.value);
  message.value = 'Задача добавлена в общий пул';
  form.value.title = '';
  setTimeout(() => {
    message.value = '';
  }, 2500);
};

onMounted(hydrate);
</script>
