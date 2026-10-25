<template>
  <section class="nk-brief" aria-labelledby="nk-brief-title">
    <header class="nk-brief__head">
      <img
        class="nk-brief__photo"
        :src="investigator.photo"
        :alt="investigator.name"
        draggable="false"
      />
      <div>
        <h2 id="nk-brief-title" class="nk-brief__title">{{ investigator.name }}</h2>
        <p class="nk-brief__role">{{ investigator.title }}</p>
        <p class="nk-brief__when">{{ stage.weekday }}, 10:00</p>
      </div>
    </header>
    <div class="nk-brief__body">
      <p v-for="(line, i) in stage.briefing" :key="i" class="nk-brief__line">{{ line }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { NokturnStageView } from '~/events/nokturn/types';

defineProps<{
  stage: NokturnStageView;
  investigator: { name: string; title: string; photo: string };
}>();
</script>
