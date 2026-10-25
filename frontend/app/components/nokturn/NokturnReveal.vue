<template>
  <section class="nk-reveal" aria-labelledby="nk-reveal-title">
    <header class="nk-reveal__head">
      <h2 id="nk-reveal-title" class="nk-reveal__title">Пятница, 15:00. Развязка</h2>
    </header>

    <div class="nk-reveal__text">
      <p v-for="(line, i) in reveal.text" :key="i">{{ line }}</p>
    </div>

    <h3 class="nk-reveal__sub">Роли шестерых</h3>
    <ul class="nk-reveal__roles">
      <li v-for="s in suspects" :key="s.id">
        <img :src="s.photo" :alt="s.name" draggable="false" />
        <div>
          <p class="nk-reveal__name">{{ s.name }}</p>
          <p class="nk-reveal__role">{{ reveal.roles[s.id]?.role }}</p>
          <p class="nk-reveal__hides">Скрывал: {{ reveal.roles[s.id]?.hides }}</p>
        </div>
      </li>
    </ul>

    <h3 class="nk-reveal__sub">Голоса по дням</h3>
    <div class="nk-reveal__chart">
      <div v-for="row in reveal.votesByStage" :key="row.stage" class="nk-reveal__col">
        <div class="nk-reveal__bars">
          <span
            v-for="s in suspects"
            :key="s.id"
            class="nk-reveal__bar"
            :class="{ 'is-culprit': s.id === 'roman' }"
            :style="{ height: `${barHeight(row.counts[s.id] || 0)}%` }"
            :title="`${s.name}: ${row.counts[s.id] || 0}`"
          />
        </div>
        <p class="nk-reveal__col-label">Этап {{ row.stage }}</p>
      </div>
    </div>

    <h3 class="nk-reveal__sub">Итоговая таблица</h3>
    <ol class="nk-reveal__board">
      <li v-for="(r, i) in reveal.leaderboard" :key="r.userId">
        <span class="nk-reveal__rank">{{ i + 1 }}</span>
        <span class="nk-reveal__who">{{ r.name }}</span>
        <span class="nk-reveal__pts">{{ r.points }}</span>
      </li>
      <li v-if="!reveal.leaderboard.length" class="nk-reveal__empty">Баллов пока ни у кого нет.</li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import type { NokturnSuspect } from '~/events/nokturn/types';

type Reveal = {
  text: string[];
  roles: Record<string, { role: string; hides: string }>;
  votesByStage: { stage: number; counts: Record<string, number> }[];
  leaderboard: { userId: number; name: string; points: number }[];
};

const props = defineProps<{ reveal: Reveal; suspects: NokturnSuspect[] }>();

const maxCount = computed(() => {
  let max = 1;
  for (const row of props.reveal.votesByStage) {
    for (const v of Object.values(row.counts)) max = Math.max(max, v);
  }
  return max;
});

const barHeight = (n: number) => Math.round((n / maxCount.value) * 100);
</script>
