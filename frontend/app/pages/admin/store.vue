<template>
  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h2 class="section-title">Редактор магазина</h2>
        <p class="muted">Управление внутренними наградами, ценами и лимитами.</p>
      </div>
      <button class="button primary" type="button">+ Награда</button>
    </div>

    <div class="grid-three">
      <article v-for="reward in storeRewards" :key="reward.id" class="card task-item">
        <div class="row">
          <strong>{{ reward.name }}</strong>
          <label class="toggle-wrap">
            <input v-model="reward.active" type="checkbox" class="toggle-input" />
            <span class="toggle-ui" />
          </label>
        </div>
        <p class="muted">Категория: {{ reward.category }}</p>
        <div class="inline-controls">
          <label>
            Цена
            <input v-model.number="reward.price" type="number" min="0" />
          </label>
          <label>
            Лимит/мес
            <input v-model.number="reward.monthly_limit" type="number" min="1" />
          </label>
        </div>
        <button class="button ghost" type="button">Сохранить</button>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
const { storeRewards } = useAdminData();
</script>
