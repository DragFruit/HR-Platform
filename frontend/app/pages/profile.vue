<template>
  <section class="card section-card">
    <h2 class="section-title">Профиль</h2>
    <p class="muted">Рост, цели и персональная статистика.</p>
    <div class="grid-two" style="margin-top: 16px">
      <article class="card">
        <p class="soft">Сотрудник</p>
        <p class="stat-value">{{ user?.name ?? '—' }}</p>
      </article>
      <article class="card">
        <p class="soft">Подразделение</p>
        <p class="stat-value">{{ user?.department ?? '—' }}</p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
const { user } = useAuth();
</script>
