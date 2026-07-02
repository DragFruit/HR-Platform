<template>
  <section class="creative-hero page-hero">
    <div>
      <p class="eyebrow">Администрирование</p>
      <h2>Центр управления платформой</h2>
      <p class="muted">Пустой старт: наполняйте справочники и модули в нужном порядке, как в реальной компании.</p>
    </div>
  </section>

  <section v-if="setupIncomplete" class="card section-card onboarding-box">
    <h3 class="section-title">Рекомендуемый порядок настройки</h3>
    <ol class="onboarding-steps">
      <li :class="{ done: employeeCount > 0 }">
        <NuxtLink to="/admin/employees">Сотрудники</NuxtLink> — добавьте людей и привяжите email к аккаунтам входа
      </li>
      <li :class="{ done: orgUnits.length > 0 }">
        <NuxtLink to="/admin/organization">Оргструктура</NuxtLink> — директора и отделы (по желанию)
      </li>
      <li :class="{ done: taskCount > 0 }">
        <NuxtLink to="/admin/tasks">Задачи</NuxtLink> — опубликуйте задачи в общий пул
      </li>
      <li>
        <NuxtLink to="/admin/adaptation">Адаптация</NuxtLink> — сотрудники проходят тесты после привязки профиля
      </li>
    </ol>
  </section>

  <section class="grid-three">
    <article class="card admin-stat">
      <p class="soft">Сотрудников</p>
      <p class="stat-value">{{ employeeCount }}</p>
    </article>
    <article class="card admin-stat">
      <p class="soft">Задач в пуле</p>
      <p class="stat-value">{{ poolTaskCount }}</p>
    </article>
    <article class="card admin-stat">
      <p class="soft">Отделов в оргсхеме</p>
      <p class="stat-value">{{ orgUnits.length }}</p>
    </article>
  </section>

  <section class="grid-two">
    <article class="card">
      <h3 class="section-title">Быстрые действия</h3>
      <div class="admin-actions">
        <NuxtLink to="/admin/employees" class="button primary">Сотрудники</NuxtLink>
        <NuxtLink to="/admin/tasks" class="button ghost">Задачи</NuxtLink>
        <NuxtLink to="/admin/organization" class="button ghost">Структура</NuxtLink>
        <NuxtLink to="/admin/vacations" class="button ghost">Отпуска</NuxtLink>
        <NuxtLink to="/admin/store" class="button ghost">Магазин</NuxtLink>
        <NuxtLink to="/admin/adaptation" class="button ghost">
          Адаптация
          <span v-if="adaptationUnseen > 0" class="tag learning">{{ adaptationUnseen }}</span>
        </NuxtLink>
        <NuxtLink to="/admin/notifications" class="button ghost">
          Уведомления
          <span v-if="adminNotificationsUnseen > 0" class="tag learning">{{ adminNotificationsUnseen }}</span>
        </NuxtLink>
      </div>
    </article>
    <article class="card">
      <h3 class="section-title">Связи модулей</h3>
      <ul class="list-reset soft-links">
        <li>Сотрудник в справочнике (в т.ч. руководитель) → отпуска, согласования, адаптация</li>
        <li>Email = аккаунт входа → личный кабинет и кошелёк</li>
        <li>Задача в пуле → взять → завершить → валюта на кошелёк</li>
      </ul>
    </article>
  </section>
</template>

<script setup lang="ts">
const { orgUnits } = useOrgStructure();
const { employees, employeeCount, hydrate: hydrateEmployees } = useEmployees();
const { tasks, poolTasks, hydrate: hydrateTasks } = useTasks();

const taskCount = computed(() => tasks.value.length);
const poolTaskCount = computed(() => poolTasks.value.length);
const setupIncomplete = computed(
  () => employeeCount.value === 0 || taskCount.value === 0
);

const { unseenCount: adaptationUnseen, loadAdminAttempts } = useAdaptation();
const { unseenCount: adminNotificationsUnseen, loadNotifications } = useAdminNotifications();

onMounted(() => {
  hydrateEmployees();
  hydrateTasks();
  loadAdminAttempts().catch(() => {});
  loadNotifications().catch(() => {});
});
</script>
