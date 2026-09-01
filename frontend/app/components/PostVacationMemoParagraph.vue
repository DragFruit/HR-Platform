<template>
  <template v-if="typeof paragraph === 'string'">{{ paragraph }}</template>
  <template v-else>
    <template v-for="(segment, index) in paragraph" :key="index">
      <span v-if="segment.kind === 'text'">{{ segment.value }}</span>
      <img
        v-else
        :src="segment.src"
        alt=""
        class="pvm-inline-illust"
        width="24"
        height="24"
      />
    </template>
  </template>
</template>

<script setup lang="ts">
import type { PostVacationMemoParagraph } from '~/data/postVacationMemoSlides';

defineProps<{
  paragraph: PostVacationMemoParagraph;
}>();
</script>
