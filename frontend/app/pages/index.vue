<template>
  <section class="creative-hero dashboard-hero">
    <div class="dashboard-hero__inner">
      <div class="dashboard-hero__copy">
        <p class="eyebrow">Твой прогресс сегодня</p>
        <h2>Привет, {{ userName }} 👋</h2>
        <p v-if="!employeeProfile && !isAdmin" class="gift-error">
          Ваш аккаунт не привязан к справочнику сотрудников. Попросите HR добавить запись с вашим email.
        </p>
        <p v-else class="muted">{{ welcomeHint }}</p>
        <div v-if="levelProgress > 0" class="progress" aria-label="Прогресс">
          <span :style="{ width: `${levelProgress}%` }" />
        </div>
        <p v-if="completedTasks > 0" class="soft">{{ completedTasks }} завершённых задач</p>
        <div class="hero-stat-tags" role="list" aria-label="Показатели">
          <div class="hero-pill hero-pill--stat" role="listitem">
            <span class="hero-pill__label">Баланс</span>
            <strong class="hero-pill__value">{{ balance }}</strong>
          </div>
          <span class="hero-pill-sep" aria-hidden="true">+</span>
          <div class="hero-pill hero-pill--stat" role="listitem">
            <span class="hero-pill__label">Активных</span>
            <strong class="hero-pill__value">{{ myActiveTasks.length }}</strong>
          </div>
          <span class="hero-pill-sep" aria-hidden="true">+</span>
          <div class="hero-pill hero-pill--stat" role="listitem">
            <span class="hero-pill__label">Завершено</span>
            <strong class="hero-pill__value">{{ completedTasks }}</strong>
          </div>
          <span class="hero-pill-sep" aria-hidden="true">+</span>
          <div class="hero-pill hero-pill--stat" role="listitem">
            <span class="hero-pill__label">За месяц</span>
            <strong class="hero-pill__value">+{{ monthTurnover.credited }}</strong>
          </div>
        </div>
        <div class="hero-actions">
          <NuxtLink to="/adaptation" class="button primary">Адаптация</NuxtLink>
          <NuxtLink to="/tasks" class="button ghost">Задачи</NuxtLink>
          <NuxtLink to="/store" class="button ghost">Магазин</NuxtLink>
        </div>
      </div>
    </div>

    <div class="dashboard-hero__visual" aria-hidden="true">
      <div class="dashboard-hero__visual-deco dashboard-hero__visual-deco--ring-outer" />
      <div class="dashboard-hero__visual-deco dashboard-hero__visual-deco--ring-inner" />
      <div class="dashboard-hero__visual-image" />
      <div class="dashboard-hero__visual-badge">✨</div>
    </div>

    <div class="dashboard-hero__bottom-bar" aria-hidden="true" />
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

      <div v-if="showProminentAdaptationCta" class="adaptation-cta">
        <p class="adaptation-cta__text muted">
          {{
            topTasks.length === 0
              ? 'Начните с программы адаптации — познакомьтесь с командой и процессами VBI.'
              : 'Продолжите адаптацию, чтобы быстрее войти в рабочий ритм.'
          }}
        </p>
        <NuxtLink to="/adaptation" class="button primary adaptation-cta__button">Начать адаптацию</NuxtLink>
      </div>

      <p v-else-if="topTasks.length === 0" class="muted adaptation-empty">
        Нет активных задач. Откройте раздел «Задачи» и возьмите задачу из общего пула.
      </p>

      <p v-if="topTasks.length > 0" class="adaptation-inline-link">
        <NuxtLink to="/adaptation">Программа адаптации →</NuxtLink>
      </p>
    </article>

    <article class="card">
      <h3 class="section-title">Новости коллег</h3>
      <ul class="feed-list list-reset">
        <li v-for="item in feedItems" :key="item.id" class="feed-item" :data-feed-type="item.type">
          <span class="feed-item__icon" aria-hidden="true">{{ item.icon }}</span>
          <div class="feed-item__body">
            <p class="feed-item__text">{{ item.text }}</p>
            <time class="feed-item__time">{{ item.time }}</time>
          </div>
        </li>
      </ul>
    </article>
  </section>
</template>

<script setup lang="ts">
const { user } = useAuth();
const { isVacationsOnly, homePath } = useLaunchScope();

// Пилот отпусков: «Главная» закрыта — сразу в рабочий раздел
if (isVacationsOnly.value) {
  await navigateTo(homePath(user.value?.role === 'admin'), { replace: true });
}

const { isAdmin } = usePermissions();
const { findByUserForAuth, employeeCount } = useEmployees();
const { myActiveTasks, completedCount, taskStatusLabels } = useTasks();
const { balance, monthTurnover, levelProgress } = useMockData();
const { me: adaptationMe, loadMe } = useAdaptation();
const { items: feedItems } = useColleagueFeed();

const userName = computed(() => user.value?.name ?? 'коллега');
const employeeProfile = computed(() => findByUserForAuth(user.value));
const completedTasks = completedCount;
const topTasks = computed(() => myActiveTasks.value.slice(0, 3));

const adaptationNotStarted = computed(() => {
  const data = adaptationMe.value;
  if (!data) return true;
  if (!data.employee) return true;
  return data.progress_percent < 15;
});

const showProminentAdaptationCta = computed(
  () => myActiveTasks.value.length === 0 || adaptationNotStarted.value
);

const welcomeHint = computed(() => {
  if (adaptationNotStarted.value && myActiveTasks.value.length === 0) {
    return 'Добро пожаловать! Пройдите адаптацию или возьмите первую задачу из пула.';
  }
  if (myActiveTasks.value.length) {
    return `У вас ${myActiveTasks.value.length} активных задач. Завершите их, чтобы получить валюту.`;
  }
  if (completedTasks.value > 0) {
    return 'Отличная работа. Возьмите новую задачу или проверьте прогресс адаптации.';
  }
  return 'Возьмите задачу из общего пула или пройдите этапы адаптации.';
});

onMounted(() => {
  loadMe().catch(() => {});
});
</script>
