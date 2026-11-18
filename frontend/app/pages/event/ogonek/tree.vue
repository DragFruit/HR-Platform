<template>
  <div class="ogt og-theme">
    <!-- Шапка липнет: ёлка длинная, кнопки нужны на любой высоте -->
    <header class="ogt__head" :style="{ top: `${stickyTop}px` }">
      <div class="ogt__titles">
        <h1 class="ogt__title">Ёлка желаний</h1>
        <p class="ogt__lead">Одна на всех. Нажмите на игрушку, чтобы прочитать пожелание.</p>
      </div>
      <div class="ogt__actions">
        <span class="ogt__count">{{ count }} {{ toysWord }}</span>
        <button v-if="myToyId" type="button" class="ogt__btn" @click="treeRef?.reveal(myToyId)">Найти мою</button>
        <NuxtLink v-else class="ogt__btn" to="/event/ogonek?day=6">Повесить свою</NuxtLink>
        <NuxtLink class="ogt__btn ogt__btn--ghost" to="/event/ogonek">К адвенту</NuxtLink>
      </div>
    </header>

    <p v-if="pending" class="ogt__state">Наряжаем ёлку...</p>
    <p v-else-if="error" class="ogt__state" role="alert">{{ error }}</p>
    <template v-else>
      <p v-if="!toys.length" class="ogt__state">На ёлке пока пусто. Первая игрушка появится из окна 6.</p>
      <OgonekTree ref="treeRef" :toys="toys" :my-toy-id="myToyId" />
      <p class="ogt__foot">Это низ ёлки. Подарки, конечно, тоже есть.</p>
    </template>
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
const treeRef = ref<{ reveal: (id: string) => void } | null>(null);

const toysWord = computed(() => {
  const n = count.value;
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'игрушка';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'игрушки';
  return 'игрушек';
});

/** Шапка ёлки липнет сразу под шапкой платформы. */
const stickyTop = ref(0);
function measureStickyTop() {
  let bottom = 0;
  for (const el of document.querySelectorAll<HTMLElement>('.topbar, .mob-top')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || !/sticky|fixed/.test(cs.position)) continue;
    bottom = Math.max(bottom, el.getBoundingClientRect().height);
  }
  stickyTop.value = Math.round(bottom);
}

onMounted(async () => {
  measureStickyTop();
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
/* Токены .og-theme — в main.css. Фон — зимняя ночь, ёлка на нём светится. */
.ogt {
  /* Своё наложение: z-index игрушек не должен перекрывать шапку платформы */
  isolation: isolate;
  background:
    radial-gradient(90% 40% at 50% 8%, rgba(255, 211, 92, 0.14), transparent 70%),
    linear-gradient(180deg, #1b2440 0%, #2a1f3a 45%, #3a0911 100%);
  border: 2px solid var(--og-line);
  box-shadow: 6px 6px 0 var(--og-shade);
  min-height: 60vh;
  padding-bottom: 28px;
}

.ogt__head {
  position: sticky;
  z-index: 4000;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px 18px;
  flex-wrap: wrap;
  padding: 14px clamp(14px, 2.4vw, 24px);
  background: rgba(27, 36, 64, 0.92);
  border-bottom: 2px solid var(--og-line);
  backdrop-filter: blur(4px);
}

.ogt__title {
  margin: 0;
  font-family: var(--og-pixel);
  font-size: clamp(16px, 2.4vw, 22px);
  font-weight: 400;
  line-height: 1.3;
  color: var(--og-gold);
  text-shadow: 0 0 18px rgba(255, 207, 74, 0.5), 3px 3px 0 #6b2a00;
}

.ogt__lead { margin: 6px 0 0; color: #f6d9d6; font-size: 15px; }

.ogt__actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.ogt__count {
  font-family: var(--og-pixel);
  font-size: 10px;
  color: var(--og-gold-soft);
  padding: 9px 10px;
  border: 2px solid var(--og-line);
}

.ogt__btn {
  font-family: var(--og-pixel);
  font-size: 9px;
  line-height: 1.4;
  padding: 10px 12px;
  border: 0;
  cursor: pointer;
  background: var(--og-gold);
  color: #3a2600;
  box-shadow: 3px 3px 0 #6b2a00;
  text-decoration: none;
}

.ogt__btn--ghost { background: transparent; color: #ffd9d6; box-shadow: none; border: 2px solid var(--og-line); }

.ogt__state { margin: 20px; color: var(--og-muted); }

.ogt :deep(.og-tree) { padding-top: 36px; }

.ogt__foot {
  margin: 14px 0 0;
  text-align: center;
  font-family: var(--og-pixel);
  font-size: 9px;
  color: var(--og-muted);
}
</style>
