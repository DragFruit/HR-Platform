<template>
  <section class="card row">
    <div>
      <h2 class="section-title">Магазин наград</h2>
      <p class="muted">Обменивай внутреннюю валюту на реальные бенефиты</p>
    </div>
    <div class="pill">Баланс: {{ balance }}</div>
  </section>

  <section class="grid-three">
    <article v-for="item in storeItems" :key="item.id" class="card task-item">
      <div class="row">
        <h3>{{ item.image }} {{ item.name }}</h3>
        <span class="tag learning">{{ item.category }}</span>
      </div>
      <p class="muted">Лимит: {{ item.monthly_limit }} / месяц</p>
      <p class="stat-value" style="font-size: 1.5rem;">{{ item.price }}</p>
      <button class="button" :class="balance >= item.price ? 'primary' : 'ghost'">
        {{ balance >= item.price ? 'Купить' : 'Недостаточно валюты' }}
      </button>
    </article>
  </section>
</template>

<script setup lang="ts">
const { storeItems } = useMockData();
const { balance } = useWallet();
</script>