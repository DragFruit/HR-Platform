<template>
  <div
    v-if="showOverlay"
    class="pvm-overlay"
    :class="{ 'is-plain': ui === 'collapsing' }"
    :role="ui === 'collapsing' ? undefined : 'dialog'"
    :aria-modal="ui === 'collapsing' ? undefined : 'true'"
    :aria-labelledby="slideTitleId"
  >
    <div
      ref="stageRef"
      class="pvm-stage"
      :class="{ 'is-collapse': ui === 'collapsing' }"
      @click.stop
    >
      <template v-if="ui === 'welcome' || ui === 'collapsing'">
        <div class="pvm-welcome" :class="{ 'is-fading': ui === 'collapsing' }">
          <div class="pvm-visual pvm-visual--welcome">
            <img
              v-if="welcome.coverSrc"
              :src="welcome.coverSrc"
              alt=""
              class="pvm-cover"
              width="320"
              height="320"
            />
          </div>
          <div class="pvm-body-wrap">
            <p v-if="welcome.kicker" class="pvm-kicker">{{ welcome.kicker }}</p>
            <h2 :id="slideTitleId" class="pvm-title">{{ welcome.title }}</h2>
            <div class="pvm-copy">
              <p v-for="(para, i) in welcome.paragraphs" :key="i" class="pvm-text">{{ para }}</p>
            </div>
            <div class="pvm-nav pvm-nav--welcome">
              <button class="button primary pvm-thanks" type="button" @click="onThanks">
                {{ welcome.cta }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="ui === 'collapsing'" class="pvm-dock-face" aria-hidden="true">
          <img :src="welcome.coverSrc" alt="" class="pvm-dock-face__img" width="64" height="64" />
          <span class="pvm-dock-face__copy">
            <strong>{{ dockCopy.title }}</strong>
            <em>{{ dockCopy.label }}</em>
          </span>
        </div>
      </template>

      <div v-else class="pvm-strip" :style="{ transform: `translate3d(${-index * 100}%, 0, 0)` }">
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
          <span class="pvm-geo__ribbon" />
        </div>

        <article v-for="item in slides" :key="item.id" class="pvm-slide">
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

  <button
    v-if="showDock"
    ref="dockRef"
    class="pvm-dock"
    :class="{ 'is-flying': ui === 'flying' }"
    type="button"
    :style="dockStyle"
    :aria-label="`${dockCopy.title}. ${dockCopy.label}`"
    @click="openCarousel"
  >
    <img :src="welcome.coverSrc" alt="" class="pvm-dock__img" width="72" height="72" />
    <span class="pvm-dock__copy">
      <strong>{{ dockCopy.title }}</strong>
      <em>{{ dockCopy.label }}</em>
    </span>
  </button>
</template>

<script setup lang="ts">
const {
  ui,
  welcome,
  dockCopy,
  slides,
  slide,
  index,
  sayThanks,
  finishFly,
  openCarousel,
  next,
  prev
} = usePostVacationMemo();

const slideTitleId = 'pvm-title';
const stageRef = ref<HTMLElement | null>(null);
const dockRef = ref<HTMLButtonElement | null>(null);
const dockStyle = ref<Record<string, string>>({});

const showOverlay = computed(() => ui.value === 'welcome' || ui.value === 'collapsing' || ui.value === 'carousel');
const showDock = computed(() => ui.value === 'flying' || ui.value === 'docked');

const reducedMotion = () =>
  import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const onThanks = async () => {
  await sayThanks();
  await nextTick();
  const collapseMs = reducedMotion() ? 0 : 420;
  window.setTimeout(() => {
    void flyToCorner();
  }, collapseMs);
};

const flyToCorner = async () => {
  const fromEl = stageRef.value;
  if (!fromEl) {
    finishFly();
    return;
  }
  const from = fromEl.getBoundingClientRect();
  ui.value = 'flying';
  dockStyle.value = {
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    right: 'auto',
    bottom: 'auto'
  };
  await nextTick();
  const el = dockRef.value;
  if (!el) {
    finishFly();
    return;
  }
  const width = 280;
  const height = 76;
  const toX = Math.max(16, window.innerWidth - 20 - width);
  const toY = Math.max(16, window.innerHeight - 20 - height);
  const dx = toX - from.left;
  const dy = toY - from.top;

  if (reducedMotion()) {
    finishFly();
    dockStyle.value = {};
    return;
  }

  const anim = el.animate(
    [
      { transform: 'translate(0, 0)' },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.18 - 96}px)`, offset: 0.42 },
      { transform: `translate(${dx}px, ${dy}px)` }
    ],
    { duration: 720, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
  );
  await anim.finished.catch(() => {});
  dockStyle.value = {};
  finishFly();
};
</script>
