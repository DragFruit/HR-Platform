<template>
  <div
    v-if="isOpen"
    class="pvm-overlay"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="slideTitleId"
  >
    <div class="pvm-stage" @click.stop>
      <span class="pvm-sq pvm-sq--t1" aria-hidden="true" />
      <span class="pvm-sq pvm-sq--t2" aria-hidden="true" />
      <span class="pvm-sq pvm-sq--r1" aria-hidden="true" />
      <span class="pvm-sq pvm-sq--r2" aria-hidden="true" />
      <span class="pvm-sq pvm-sq--b1" aria-hidden="true" />
      <span class="pvm-sq pvm-sq--b2" aria-hidden="true" />
      <span class="pvm-sq pvm-sq--l1" aria-hidden="true" />
      <span class="pvm-sq pvm-sq--l2" aria-hidden="true" />

      <article class="pvm-card">
        <p v-if="slide.kicker" class="pvm-kicker">{{ slide.kicker }}</p>
        <img
          v-if="slide.coverSrc"
          :src="slide.coverSrc"
          alt=""
          class="pvm-cover"
          width="320"
          height="320"
        />
        <h2 :id="slideTitleId" class="pvm-title">{{ slide.title }}</h2>
        <div class="pvm-copy">
          <p v-for="(para, i) in slide.paragraphs" :key="i" class="pvm-body">{{ para }}</p>
        </div>

        <div class="pvm-nav">
          <div class="pvm-dots" aria-hidden="true">
            <span
              v-for="(item, i) in slides"
              :key="item.id"
              class="pvm-dot"
              :class="{ 'is-on': i === index }"
            />
          </div>
          <button class="button primary pvm-cta" type="button" @click="next">
            {{ slide.cta }}
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
const { isOpen, slide, index, slides, next } = usePostVacationMemo();
const slideTitleId = 'pvm-title';
</script>
