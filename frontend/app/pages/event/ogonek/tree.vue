<template>
  <div class="ogt og-theme">
    <header class="ogt__head">
      <div>
        <h1 class="ogt__title">Ёлка желаний</h1>
        <p class="ogt__lead">
          Одна на всех. Каждая игрушка нарисована кем-то из нас, на каждой —
          пожелание на будущий год. Нажмите на игрушку, чтобы прочитать.
        </p>
      </div>
      <div class="ogt__actions">
        <span class="ogt__count">{{ count }} игрушек</span>
        <NuxtLink class="ogt__back" to="/event/ogonek">← К адвенту</NuxtLink>
      </div>
    </header>

    <p v-if="pending" class="ogt__state">Наряжаем ёлку...</p>
    <p v-else-if="error" class="ogt__state" role="alert">{{ error }}</p>
    <p v-else-if="!toys.length" class="ogt__state">
      На ёлке пока пусто. Первая игрушка появится из окна 6.
    </p>

    <OgonekTree v-else :toys="toys" :my-toy-id="myToyId" :width="640" />
  </div>
</template>

<script setup lang="ts">
/** Ёлка желаний отдельным экраном (спека, раздел 4). Стиль — как у адвента. */
useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=PT+Sans:wght@400;700&family=PT+Sans+Narrow:wght@700&display=swap'
    }
  ]
});

import type { OgonekToy } from '~/events/ogonek/types';

const toys = ref<OgonekToy[]>([]);
const myToyId = ref<string | null>(null);
const count = ref(0);
const pending = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    const res = await $fetch<{ toys: OgonekToy[]; myToyId: string | null; count: number }>(
      '/api/event/ogonek/tree'
    );
    toys.value = res.toys;
    myToyId.value = res.myToyId;
    count.value = res.count;
  } catch {
    error.value = 'Не удалось загрузить ёлку. Обновите страницу.';
  } finally {
    pending.value = false;
  }
});
</script>

<style scoped>
/* Токены .og-theme задаёт страница адвента (глобальный стиль в index.vue). */
.ogt {
  background: radial-gradient(120% 80% at 50% 0%, #64101d 0%, var(--og-bg) 60%), var(--og-bg);
  border: 2px solid var(--og-line);
  box-shadow: 6px 6px 0 var(--og-shade);
  padding: 22px clamp(12px, 2.4vw, 26px) 26px;
  min-height: 60vh;
}

.ogt__head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.ogt__title {
  margin: 0;
  font-family: var(--og-pixel);
  font-size: clamp(18px, 3vw, 26px);
  font-weight: 400;
  line-height: 1.3;
  color: var(--og-gold);
  text-shadow: 0 0 18px rgba(255, 207, 74, 0.5), 3px 3px 0 #6b2a00;
}

.ogt__lead { margin: 10px 0 0; max-width: 56ch; line-height: 1.5; color: #f6d9d6; font-size: 17px; }

.ogt__actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }

.ogt__count {
  font-family: var(--og-pixel);
  font-size: 10px;
  color: var(--og-gold-soft);
  background: var(--og-bg-2);
  border: 2px solid var(--og-line);
  padding: 10px 12px;
  box-shadow: 4px 4px 0 var(--og-shade);
}

.ogt__back {
  font-family: var(--og-pixel);
  font-size: 10px;
  color: #ffd9d6;
  text-decoration: none;
  border: 2px solid var(--og-line);
  padding: 10px 14px;
}

.ogt__back:hover { border-color: var(--og-gold); }

.ogt__state { color: var(--og-muted); }

@media (max-width: 700px) {
  .ogt { padding: 14px; }
}
</style>
