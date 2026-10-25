<template>
  <figure class="nk-card" :class="[`nk-card--${variant}`, `nk-card--${evidence.kind}`]">
    <div class="nk-card__frame">
      <img class="nk-card__img" :src="evidence.image" :alt="evidence.title" draggable="false" />
      <!--
        Предмет лежит на прозрачном фоне, пакет — отдельная накладка,
        бирка рисуется кодом по белой полосе пакета (docs/quests/sinij-nokturn-art.md).
      -->
      <img
        v-if="evidence.kind === 'prop' && bagSrc"
        class="nk-card__bag"
        :src="bagSrc"
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <p v-if="evidence.kind === 'prop'" class="nk-card__label">
        {{ variant === 'board' ? evidence.title : tagLine }}
      </p>
      <div v-else-if="evidence.kind === 'doc'" class="nk-card__doc">
        <p class="nk-card__doc-title">{{ evidence.title }}</p>
        <template v-if="variant === 'full'">
          <p v-for="(line, i) in evidence.tag" :key="i" class="nk-card__doc-line">{{ line }}</p>
        </template>
        <p v-else class="nk-card__doc-line nk-card__doc-line--clip">{{ tagLine }}</p>
      </div>
    </div>

    <figcaption v-if="evidence.kind !== 'prop' || variant === 'full'" class="nk-card__cap">
      <span class="nk-card__cap-title">{{ evidence.title }}</span>
      <template v-if="variant === 'full' && evidence.kind === 'photo'">
        <span v-for="(line, i) in evidence.tag" :key="i" class="nk-card__cap-line">{{ line }}</span>
      </template>
    </figcaption>

    <img
      v-if="variant === 'full' && evidence.back"
      class="nk-card__back"
      :src="evidence.back"
      alt="Обратная сторона снимка"
      draggable="false"
    />
  </figure>
</template>

<script setup lang="ts">
import type { NokturnEvidence } from '~/events/nokturn/types';

const props = withDefaults(
  defineProps<{
    evidence: NokturnEvidence;
    variant?: 'board' | 'safe' | 'full';
    bagSrc?: string;
  }>(),
  { variant: 'safe', bagSrc: '' }
);

const tagLine = computed(() => props.evidence.tag.join(' '));
</script>
