<template>
  <section class="creative-hero page-hero">
    <div>
      <p class="eyebrow">Администрирование</p>
      <h2>Центр управления платформой</h2>
      <p class="muted">
        Настройка оргструктуры, сотрудников, графика отпусков, подчинения и внутреннего магазина наград.
      </p>
    </div>
  </section>

  <section class="grid-three">
    <article class="card admin-stat">
      <p class="soft">Подразделения</p>
      <p class="stat-value">{{ orgUnits.length }}</p>
    </article>
    <article class="card admin-stat">
      <p class="soft">Активные пользователи</p>
      <p class="stat-value">{{ activeUsers }}</p>
    </article>
    <article class="card admin-stat">
      <p class="soft">Награды в магазине</p>
      <p class="stat-value">{{ activeRewards }}</p>
    </article>
  </section>

  <section class="grid-two">
    <article class="card">
      <h3 class="section-title">Быстрые действия</h3>
      <div class="admin-actions">
        <NuxtLink to="/admin/organization" class="button ghost">Структура компании</NuxtLink>
        <NuxtLink to="/admin/employees" class="button ghost">Сотрудники</NuxtLink>
        <NuxtLink to="/admin/vacations" class="button ghost">График отпусков</NuxtLink>
        <NuxtLink to="/admin/hierarchy" class="button ghost">Подчинение</NuxtLink>
        <NuxtLink to="/admin/users" class="button ghost">Аккаунты</NuxtLink>
        <NuxtLink to="/admin/store" class="button primary">Редактор магазина</NuxtLink>
      </div>
    </article>
    <article class="card">
      <h3 class="section-title">Последние изменения</h3>
      <ul class="list-reset">
        <li class="task-item">Обновлен лимит награды «Merch Pack»</li>
        <li class="task-item">Добавлен сотрудник в отдел Product</li>
        <li class="task-item">Изменена линия подчинения: Алина К. → Анна С.</li>
      </ul>
    </article>
  </section>
</template>

<script setup lang="ts">
const { users, storeRewards } = useAdminData();
const { orgUnits } = useOrgStructure();

const activeUsers = computed(() => users.value.filter((u) => u.status === 'active').length);
const activeRewards = computed(() => storeRewards.value.filter((r) => r.active).length);
</script>
