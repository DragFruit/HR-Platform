<template>
  <article class="nk-fix" :class="`nk-fix--${fixture.kind}`">
    <template v-if="fixture.kind === 'suspect'">
      <img
        class="nk-fix__photo"
        :src="fixture.photo"
        :alt="fixture.title"
        draggable="false"
      />
      <p class="nk-fix__name">{{ fixture.title }}</p>
      <p class="nk-fix__role">{{ fixture.lines[0] }}</p>
    </template>

    <template v-else>
      <img
        v-if="fixture.photo"
        class="nk-fix__photo nk-fix__photo--case"
        :src="fixture.photo"
        :alt="fixture.title"
        draggable="false"
      />
      <p class="nk-fix__kicker">Дело</p>
      <h3 class="nk-fix__title">{{ fixture.title }}</h3>
      <p v-if="fixture.subtitle" class="nk-fix__sub">{{ fixture.subtitle }}</p>
      <p v-for="(line, i) in fixture.lines" :key="i" class="nk-fix__line">{{ line }}</p>
    </template>
  </article>
</template>

<script setup lang="ts">
import type { NokturnFixture } from '~/events/nokturn/types';

defineProps<{ fixture: NokturnFixture }>();
</script>
