<template>
  <section class="hero">
    <article class="card">
      <h2>Добро пожаловать, {{ userName }}</h2>
      <p v-if="!employeeProfile && !isAdmin" class="gift-error">
        Ваш аккаунт не привязан к справочнику сотрудников. Попросите HR добавить запись с вашим email.
      </p>
      <p v-else class="muted">{{ welcomeHint }}</p>
      <div v-if="levelProgress > 0" class="progress" aria-label="Прогресс">
        <span :style="{ width: `${levelProgress}%` }" />
      </div>
      <p v-if="completedTasks > 0" class="soft">{{ completedTasks }} завершённых задач</p>
      <div class="row">
        <NuxtLink to="/adaptation" class="button primary">Адаптация</NuxtLink>
        <NuxtLink to="/tasks" class="button ghost">Задачи</NuxtLink>
      </div>
    </article>

    <article class="card">
      <h3 class="section-title">Ваши показатели</h3>
      <div class="grid-two">
        <div>
          <p class="soft">Баланс</p>
          <p class="stat-value">{{ balance }}</p>
        </div>
        <div>
          <p class="soft">Активных задач</p>
          <p class="stat-value">{{ myActiveTasks.length }}</p>
        </div>
        <div>
          <p class="soft">Завершено задач</p>
          <p class="stat-value">{{ completedTasks }}</p>
        </div>
        <div>
          <p class="soft">Оборот за месяц</p>
          <p class="stat-value">+{{ monthTurnover.credited }}</p>
        </div>
      </div>
    </article>
  </section>

  <section v-if="isAdmin && employeeCount === 0" class="card promo-card">
    <h3 class="section-title">Первый запуск платформы</h3>
    <p class="muted">Справочник сотрудников пуст. Начните с админ-панели:</p>
    <div class="row">
      <NuxtLink to="/admin/employees" class="button primary">Добавить сотрудников</NuxtLink>
      <NuxtLink to="/admin/tasks" class="button ghost">Создать задачи</NuxtLink>
    </div>
  </section>

  <section class="grid-two">
    <article class="card">
      <h3 class="section-title">Приоритетные задачи</h3>
      <ul class="list-reset">
        <li v-if="topTasks.length === 0" class="task-item muted">
          Нет активных задач. Откройте раздел «Задачи» и возьмите задачу из общего пула.
        </li>
        <li v-for="task in topTasks" :key="task.id" class="task-item">
          <div class="row">
            <strong>{{ task.title }}</strong>
            <span class="tag status-tag status-active">{{ taskStatusLabels.active }}</span>
          </div>
          <div class="row">
            <span class="muted">Награда: +{{ task.reward_amount }}</span>
            <span class="muted">До: {{ task.deadline }}</span>
          </div>
        </li>
      </ul>
    </article>

    <article class="card">
      <h3 class="section-title">Ближайшие награды</h3>
      <ul class="list-reset">
        <li v-for="item in storeItems" :key="item.id" class="task-item">
          <div class="row">
            <strong>{{ item.image }} {{ item.name }}</strong>
            <span>{{ item.price }}</span>
          </div>
          <p class="muted">Категория: {{ item.category }} · Лимит: {{ item.monthly_limit }}/мес</p>
        </li>
      </ul>
    </article>
  </section>
</template>

<script setup lang="ts">
const { user } = useAuth();
const { isAdmin } = usePermissions();
const { findByUserForAuth, employeeCount } = useEmployees();
const { myActiveTasks, completedCount, taskStatusLabels } = useTasks();
const { balance, monthTurnover, storeItems, levelProgress } = useMockData();

const userName = computed(() => user.value?.name ?? 'коллега');
const employeeProfile = computed(() => findByUserForAuth(user.value));
const completedTasks = completedCount;
const topTasks = computed(() => myActiveTasks.value.slice(0, 3));

const welcomeHint = computed(() => {
  if (myActiveTasks.value.length) {
    return `У вас ${myActiveTasks.value.length} активных задач. Завершите их, чтобы получить валюту.`;
  }
  if (completedTasks.value > 0) {
    return 'Отличная работа. Возьмите новую задачу или проверьте прогресс адаптации.';
  }
  return 'Возьмите задачу из общего пула или пройдите этапы адаптации.';
});
</script>
