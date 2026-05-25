<template>
  <section class="hero">
    <article class="card">
      <h2>Добро пожаловать, {{ userName }}</h2>
      <p class="muted">
        Ты на 68% к следующему уровню. Заверши 2 задачи и сможешь забрать новую награду из магазина.
      </p>
      <div class="progress" aria-label="Прогресс уровня">
        <span :style="{ width: `${levelProgress}%` }" />
      </div>
      <p class="soft">Уровень 7 · {{ levelProgress }}% до уровня 8</p>
      <div class="row">
        <NuxtLink to="/adaptation" class="button primary">Запустить адаптацию</NuxtLink>
        <NuxtLink to="/tasks" class="button ghost">Приоритетные задачи</NuxtLink>
      </div>
    </article>

    <article class="card">
      <h3 class="section-title">Ключевые метрики недели</h3>
      <div class="grid-two">
        <div>
          <p class="soft">Завершено задач</p>
          <p class="stat-value">12</p>
        </div>
        <div>
          <p class="soft">Начислено валюты</p>
          <p class="stat-value">+1 450</p>
        </div>
        <div>
          <p class="soft">Серия активности</p>
          <p class="stat-value">6 дней</p>
        </div>
        <div>
          <p class="soft">Покупок в магазине</p>
          <p class="stat-value">3</p>
        </div>
      </div>
    </article>
  </section>

  <section class="card promo-card">
    <div class="row">
      <div>
        <p class="eyebrow">Новый модуль</p>
        <h3 class="section-title">Адаптация сотрудников</h3>
        <p class="muted">Направления onboarding, buddy-программа и 30-дневный трек в ярком HR-интерфейсе.</p>
      </div>
      <NuxtLink to="/adaptation" class="button primary">Открыть модуль</NuxtLink>
    </div>
  </section>

  <section class="grid-two">
    <article class="card">
      <h3 class="section-title">Приоритетные задачи</h3>
      <ul class="list-reset">
        <li v-if="topTasks.length === 0" class="task-item muted">Нет активных задач. Возьми задачу в разделе «Задачи».</li>
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
const { tasks, storeItems, levelProgress } = useMockData();
const userName = computed(() => user.value?.name ?? 'коллега');

const labels = {
  personal_brand: 'Личный бренд',
  more_money: 'Деньги',
  more_free_time: 'Свободное время',
  new_interesting: 'Новое',
  learning: 'Обучение'
};

const topTasks = computed(() => tasks.slice(0, 3));
</script>