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
          <ol v-if="slide.points?.length" class="pvm-points">
            <li v-for="point in slide.points" :key="point">{{ point }}</li>
          </ol>
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
          <div class="pvm-arrows">
            <button
              v-if="index > 0"
              class="pvm-arrow pvm-arrow--back"
              type="button"
              aria-label="Назад"
              @click="prev"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 12H8M12 8l-4 4 4 4" />
              </svg>
            </button>
            <button
              class="pvm-arrow pvm-arrow--fwd"
              type="button"
              :aria-label="slide.cta"
              @click="next"
            >
              <svg viewBox="0 0 112 24" aria-hidden="true">
                <path d="M8 12h88M84 6l12 6-12 6" />
              </svg>
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
const { isOpen, slide, index, slides, next, prev } = usePostVacationMemo();
const slideTitleId = 'pvm-title';
</script>
