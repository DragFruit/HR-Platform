<template>
  <div
    v-if="isOpen"
    class="pvm-overlay"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="slideTitleId"
  >
    <div class="pvm-stage" @click.stop>
      <div
        class="pvm-strip"
        :style="{ transform: `translate3d(${-index * 100}%, 0, 0)` }"
      >
        <div class="pvm-geo" aria-hidden="true">
          <span class="pvm-geo__fill" />
          <span class="pvm-geo__arc pvm-geo__arc--a" />
          <span class="pvm-geo__arc pvm-geo__arc--b" />
          <span class="pvm-geo__circle pvm-geo__circle--s1" />
          <span class="pvm-geo__sq pvm-geo__sq--b12" />
          <span class="pvm-geo__circle pvm-geo__circle--b12" />
          <span class="pvm-geo__circle pvm-geo__circle--b23" />
          <span class="pvm-geo__sq pvm-geo__sq--b23" />
          <span class="pvm-geo__circle pvm-geo__circle--b34" />
          <span class="pvm-geo__sq pvm-geo__sq--b34" />
          <span class="pvm-geo__circle pvm-geo__circle--b45" />
          <span class="pvm-geo__sq pvm-geo__sq--b45" />
          <span class="pvm-geo__ribbon" />
        </div>

        <article
          v-for="item in slides"
          :key="item.id"
          class="pvm-slide"
        >
          <div class="pvm-visual">
            <img
              v-if="item.coverSrc"
              :src="item.coverSrc"
              alt=""
              class="pvm-cover"
              width="320"
              height="320"
            />
          </div>
          <div class="pvm-body-wrap">
            <p v-if="item.kicker" class="pvm-kicker">{{ item.kicker }}</p>
            <h2 :id="item.id === slide.id ? slideTitleId : undefined" class="pvm-title">
              {{ item.title }}
            </h2>
            <div class="pvm-copy">
              <p v-for="(para, i) in item.paragraphs" :key="i" class="pvm-text">{{ para }}</p>
            </div>
            <div class="pvm-nav">
              <div class="pvm-dots" aria-hidden="true">
                <span
                  v-for="(dot, i) in slides"
                  :key="dot.id"
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
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { isOpen, slide, index, slides, next, prev } = usePostVacationMemo();
const slideTitleId = 'pvm-title';
</script>
