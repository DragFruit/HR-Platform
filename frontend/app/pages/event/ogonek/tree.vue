<template>
  <div class="ogt">
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
/** Ёлка желаний отдельным экраном (спека, раздел 4). */
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
.ogt {
  /* Фон бордовый, а не хвойный: на хвойном сама ёлка сливалась с экраном. */
  background:
    radial-gradient(circle at 50% 8%, rgba(217, 154, 43, 0.16), transparent 58%),
    #7d1f28;
  border: 3px solid #1a1412;
  border-radius: 12px;
  padding: 22px;
  color: #e8d7b4;
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
  font-family: 'Unbounded', system-ui, sans-serif;
  font-size: 28px;
  color: #f5efe3;
}

.ogt__lead { margin: 6px 0 0; max-width: 56ch; line-height: 1.5; opacity: 0.86; }

.ogt__actions { display: flex; align-items: center; gap: 14px; }

.ogt__count {
  background: rgba(26, 20, 18, 0.45);
  border: 1px solid rgba(232, 215, 180, 0.24);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
}

.ogt__back { color: #d99a2b; text-decoration: none; font-weight: 600; }
.ogt__back:hover { text-decoration: underline; }

.ogt__state { opacity: 0.8; }

@media (max-width: 700px) {
  .ogt { padding: 14px; }
  .ogt__title { font-size: 22px; }
}
</style>
