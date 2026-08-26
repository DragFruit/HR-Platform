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
              width="340"
              height="340"
            />
          </div>
          <div class="pvm-body-wrap">
            <p v-if="welcome.kicker" class="pvm-kicker">{{ welcome.kicker }}</p>
            <h2 :id="slideTitleId" class="pvm-title">{{ welcome.title }}</h2>
            <div class="pvm-copy">
              <p v-for="(para, i) in welcome.paragraphs" :key="i" class="pvm-text">
                {{ para }}
              </p>
            </div>
            <div class="pvm-nav pvm-nav--welcome">
              <button class="pvm-later" type="button" @click="onLater">
                {{ welcome.laterCta }}
              </button>
              <button class="pvm-thanks" type="button" @click="onRead">
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
          <span class="pvm-geo__circle pvm-geo__circle--b45" />
          <span class="pvm-geo__sq pvm-geo__sq--b45" />
          <span class="pvm-geo__ribbon" />
        </div>

        <article v-for="item in slides" :key="item.id" class="pvm-slide">
          <div class="pvm-visual" :class="{ 'pvm-visual--welcome': item.id === 'intro' }">
            <img
              v-if="item.coverSrc"
              :src="item.coverSrc"
              alt=""
              class="pvm-cover"
              width="340"
              height="340"
            />
          </div>
          <div class="pvm-body-wrap">
            <p v-if="item.kicker" class="pvm-kicker">{{ item.kicker }}</p>
            <h2 :id="item.id === slide.id ? slideTitleId : undefined" class="pvm-title">
              {{ item.title }}
            </h2>
            <div class="pvm-copy">
              <p v-for="(para, i) in item.paragraphs" :key="i" class="pvm-text">
                {{ para }}
                <span v-if="item.id === 'fresh' && i === 0" class="pvm-desk-plant" aria-hidden="true">
                  <svg viewBox="0 0 20 24" focusable="false">
                    <path class="pvm-desk-plant__shift" d="M5.8 14.2h9l-1.1 8H6.9z" />
                    <path class="pvm-desk-plant__leaf" d="M10 13.4C10 13.4 7.2 8.2 7.6 3.6c.6 2.8 2.4 5.4 2.4 9.8Z" />
                    <path class="pvm-desk-plant__leaf" d="M10 13.4C10 13.4 4.8 9.6 3.4 5.8c1.8 2 4.4 4.2 6.6 7.6Z" />
                    <path class="pvm-desk-plant__leaf" d="M10 13.4C10 13.4 15.2 9.6 16.6 5.8c-1.8 2-4.4 4.2-6.6 7.6Z" />
                    <path class="pvm-desk-plant__leaf" d="M10 13.4C10 13.4 12.8 8.2 12.4 3.6c-.6 2.8-2.4 5.4-2.4 9.8Z" />
                    <path class="pvm-desk-plant__pot" d="M5 13.2h10l-1.2 8.8H6.2z" />
                  </svg>
                </span>
              </p>
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
                  v-if="!isLast"
                  class="pvm-arrow pvm-arrow--fwd"
                  type="button"
                  :aria-label="slide.cta"
                  @click="next"
                >
                  <svg viewBox="0 0 112 24" aria-hidden="true">
                    <path d="M8 12h88M84 6l12 6-12 6" />
                  </svg>
                </button>
                <button v-else class="pvm-thanks" type="button" @click="next">
                  {{ slide.cta }}
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
  isLast,
  sayThanks,
  startReading,
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

const onLater = async () => {
  await sayThanks();
  await nextTick();
  const collapseMs = reducedMotion() ? 0 : 480;
  window.setTimeout(() => {
    void flyToCorner();
  }, collapseMs);
};

const onRead = async () => {
  await startReading();
};

const quad = (t: number, a: number, b: number, c: number) => {
  const u = 1 - t;
  return u * u * a + 2 * u * t * b + t * t * c;
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
    bottom: 'auto',
    transform: 'none',
    transition: 'none'
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

  el.style.transition = 'none';
  const steps = 24;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = quad(t, 0, dx * 0.38, dx);
    const y = quad(t, 0, dy * 0.08 - 72, dy);
    frames.push({
      transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
      offset: t
    });
  }
  const anim = el.animate(frames, {
    duration: 980,
    easing: 'cubic-bezier(0.33, 0.08, 0.22, 1)',
    fill: 'forwards'
  });
  await anim.finished.catch(() => {});
  if (typeof anim.commitStyles === 'function') anim.commitStyles();
  anim.cancel();
  dockStyle.value = {
    left: 'auto',
    top: 'auto',
    right: '20px',
    bottom: '20px',
    width: `${width}px`,
    height: `${height}px`,
    transform: 'none',
    transition: 'none'
  };
  finishFly();
  await nextTick();
  dockStyle.value = {};
};
</script>
