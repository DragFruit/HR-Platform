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
        <div class="pvm-shell" :class="{ 'is-fading': ui === 'collapsing' }">
          <div class="pvm-card pvm-card--welcome">
            <div class="pvm-card__paper" aria-hidden="true" />
            <div class="pvm-card__body">
              <p v-if="welcome.kicker" class="pvm-kicker">{{ welcome.kicker }}</p>
              <h2 :id="slideTitleId" class="pvm-title pvm-title--welcome">
                <template v-if="welcome.titleLines?.length">
                  <span
                    v-for="(line, li) in welcome.titleLines"
                    :key="li"
                    class="pvm-title__line"
                  >{{ line }}</span>
                </template>
                <template v-else>{{ welcome.title }}</template>
              </h2>
              <div class="pvm-copy">
                <p v-for="(para, i) in welcome.paragraphs" :key="i" class="pvm-text">
                  <PostVacationMemoParagraph :paragraph="para" />
                </p>
              </div>
              <div class="pvm-nav pvm-nav--welcome">
                <button class="pvm-later" type="button" @click="onLater">
                  {{ welcome.laterCta }}
                </button>
                <button class="pvm-cta" type="button" @click="onRead">
                  {{ welcome.cta }}
                </button>
              </div>
            </div>
            <img
              v-if="welcome.coverSrc"
              :src="welcome.coverSrc"
              alt=""
              class="pvm-illust pvm-illust--welcome"
              width="560"
              height="560"
            />
          </div>
        </div>
        <div v-if="ui === 'collapsing'" class="pvm-dock-face" aria-hidden="true">
          <img :src="chipSrc" alt="" class="pvm-dock-face__img" width="64" height="64" />
          <span class="pvm-dock-face__copy">
            <strong>{{ dockCopy.title }}</strong>
            <em>{{ dockCopy.label }}</em>
          </span>
        </div>
      </template>

      <div v-else class="pvm-shell pvm-shell--carousel">
        <div class="pvm-card">
          <div class="pvm-card__paper" aria-hidden="true" />
          <div class="pvm-strip" :style="{ transform: `translate3d(${-index * 100}%, 0, 0)` }">
            <article
              v-for="(item, slideIdx) in slides"
              :key="item.id"
              class="pvm-slide"
              :class="[`pvm-slide--${item.id}`, { 'is-current': slideIdx === index }]"
              :aria-hidden="slideIdx === index ? undefined : 'true'"
            >
              <div class="pvm-card__body">
                <p v-if="item.kicker" class="pvm-kicker">{{ item.kicker }}</p>
                <h2
                  :id="item.id === slide.id ? slideTitleId : undefined"
                  class="pvm-title"
                >
                  <template v-if="item.titleLines?.length">
                    <span
                      v-for="(line, li) in item.titleLines"
                      :key="li"
                      class="pvm-title__line"
                    >{{ line }}</span>
                  </template>
                  <template v-else>{{ item.title }}</template>
                </h2>
                <div class="pvm-copy">
                  <p v-for="(para, i) in item.paragraphs" :key="i" class="pvm-text">
                    <PostVacationMemoParagraph :paragraph="para" />
                  </p>
                </div>
                <div class="pvm-nav" :class="{ 'pvm-nav--intro': item.id === 'intro' }">
                  <button
                    v-if="index > 0"
                    class="pvm-later"
                    type="button"
                    @click="prev"
                  >
                    Назад
                  </button>
                  <span v-else class="pvm-nav__spacer" />
                  <button
                    v-if="!isLast"
                    class="pvm-cta"
                    type="button"
                    @click="next"
                  >
                    {{ item.cta }}&nbsp;→
                  </button>
                  <button
                    v-else
                    class="pvm-cta"
                    type="button"
                    @click="next"
                  >
                    {{ item.cta }}
                  </button>
                </div>
              </div>
              <img
                v-if="item.coverSrc"
                :src="item.coverSrc"
                alt=""
                class="pvm-illust"
                :class="`pvm-illust--${item.id}`"
                width="560"
                height="560"
              />
            </article>
          </div>
        </div>
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
    <img :src="chipSrc" alt="" class="pvm-dock__img" width="72" height="72" />
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
  chipSrc,
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
