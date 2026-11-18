<template>
  <Teleport to="body">
    <section
      v-if="visible"
      class="ogmb og-theme"
      role="dialog"
      aria-modal="true"
      aria-label="Коробка с письмами"
    >
      <!-- Пока читают письмо, кнопка уходит под затемнение: она закрывает всю коробку, а не лист -->
      <button ref="closeRef" type="button" class="ogmb__x" :disabled="Boolean(reading)" @click="close">
        Закрыть коробку
      </button>

      <header class="ogmb__head">
        <h2>ВАМ ПРИШЛИ ПИСЬМА</h2>
        <p>{{ countLabel }} от коллег. Кто написал, не знает никто.</p>
      </header>

      <!-- Коробка: разрезанный спрайт подарка. Крышка улетает, письма поднимаются -->
      <div class="ogmb__scene" :class="`is-${phase}`">
        <div v-if="phase !== 'closed'" class="ogmb__letters">
          <button
            v-for="(l, i) in letters"
            :key="l.id"
            :ref="(el) => setEnvEl(l.id, el)"
            type="button"
            class="ogmb__env"
            :class="{ 'is-read': l.read, 'is-hidden': reading?.id === l.id }"
            :style="{ '--i': String(i), '--tilt': `${tilt(l.id)}deg` }"
            :aria-label="l.read ? `Письмо ${i + 1}, прочитано` : `Письмо ${i + 1}, запечатано`"
            @click="openLetter(l)"
          >
            <OgonekEnvelope :width="envWidth" :sealed="!l.read" />
          </button>
        </div>

        <button
          type="button"
          class="ogmb__box"
          :disabled="phase !== 'closed'"
          :aria-label="phase === 'closed' ? 'Открыть коробку' : 'Коробка открыта'"
          @click="openBox"
        >
          <OgonekSprite class="ogmb__lid" :rows="BOX_LID" :width="boxWidth" />
          <OgonekSprite class="ogmb__body" :rows="BOX_BODY" :width="boxWidth" />
        </button>
        <p v-if="phase === 'closed'" class="ogmb__hint">Нажмите на коробку</p>
      </div>

      <!-- Чтение: конверт вскрывается по центру, потом лист на весь экран -->
      <div v-if="reading" class="ogmb__read" @click.self="step === 'read' && closeLetter()">
        <div v-if="step !== 'read'" ref="flyRef" class="ogmb__fly">
          <OgonekEnvelope
            :width="readWidth"
            :sealed="step === 'fly'"
            :breaking="step === 'seal'"
            :flap-up="step === 'flap' || step === 'rise'"
            :sheet-out="step === 'rise'"
            :paper="paperUrl"
          />
        </div>
        <article v-else class="ogmb__paper" :style="{ backgroundImage: `url(${paperUrl})` }">
          <h3>Спасибо</h3>
          <p class="ogmb__text">{{ reading.text }}</p>
          <p class="ogmb__sign">кто-то из коллег</p>
          <button ref="foldRef" type="button" class="ogmb__fold" @click="closeLetter">Сложить письмо</button>
        </article>
      </div>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Коробка с письмами благодарности: 28 декабря — 22 января. Выскакивает при
 * первом входе, внутри конверты, каждый вскрывается отдельно: сургуч, клапан,
 * лист. Письма анонимны, порядок перемешан на сервере.
 *
 * Окно верхнего уровня: живёт на всех страницах, поэтому шрифты подключает само.
 */
import { BOX_BODY, BOX_LID, ogonekPaperUrl } from '~/events/ogonek/mailArt';
import type { OgonekMailLetter } from '~/composables/useOgonekMailbox';

useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=PT+Sans:wght@400;700&family=PT+Sans+Narrow:wght@700&family=Pixelify+Sans:wght@600&family=Neucha&display=swap'
    }
  ]
});

const mailbox = useOgonekMailbox();
const { visible } = mailbox;
const letters = computed(() => mailbox.state.value.letters);

type Phase = 'closed' | 'opening' | 'open';
type Step = 'fly' | 'seal' | 'flap' | 'rise' | 'read';

const phase = ref<Phase>('closed');
const reading = ref<OgonekMailLetter | null>(null);
const step = ref<Step>('fly');
const closeRef = ref<HTMLElement | null>(null);
const flyRef = ref<HTMLElement | null>(null);
const foldRef = ref<HTMLElement | null>(null);

const narrow = ref(false);
const envWidth = computed(() => (narrow.value ? 128 : 192));
const readWidth = computed(() => (narrow.value ? 256 : 320));
const boxWidth = computed(() => (narrow.value ? 160 : 224));
const paperUrl = computed(() => (reading.value ? ogonekPaperUrl(reading.value.id) : ''));

const envEls = new Map<string, HTMLElement>();
function setEnvEl(id: string, el: unknown) {
  if (el instanceof HTMLElement) envEls.set(id, el);
  else envEls.delete(id);
}

const countLabel = computed(() => {
  const n = letters.value.length;
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return `${n} письмо`;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} письма`;
  return `${n} писем`;
});

/** Конверты лежат чуть вразнобой, но каждый раз одинаково. */
function tilt(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 9) - 4;
}

const reduce = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const timers: ReturnType<typeof setTimeout>[] = [];
const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
const clearTimers = () => timers.splice(0).forEach(clearTimeout);

function openBox() {
  if (phase.value !== 'closed') return;
  if (reduce()) {
    phase.value = 'open';
    return;
  }
  phase.value = 'opening';
  later(650, () => { phase.value = 'open'; });
}

/** Конверт вылетает из сетки в центр и вскрывается. */
async function openLetter(l: OgonekMailLetter) {
  if (reading.value) return;
  const from = envEls.get(l.id)?.getBoundingClientRect();
  reading.value = l;
  if (reduce()) {
    step.value = 'read';
    mailbox.markRead(l.id);
    return;
  }
  step.value = 'fly';
  await nextTick();
  const fly = flyRef.value;
  if (fly && from) {
    const to = fly.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    fly.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})` },
        { transform: 'none' }
      ],
      { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }
    );
  }
  later(520, () => { step.value = 'seal'; });
  later(800, () => { step.value = 'flap'; });
  later(1280, () => { step.value = 'rise'; });
  later(1880, () => {
    step.value = 'read';
    mailbox.markRead(l.id);
    void nextTick(() => foldRef.value?.focus({ preventScroll: true }));
  });
}

function closeLetter() {
  clearTimers();
  // Вскрыли и передумали на середине: письмо всё равно считается открытым
  if (reading.value) mailbox.markRead(reading.value.id);
  reading.value = null;
  step.value = 'fly';
}

function close() {
  clearTimers();
  reading.value = null;
  mailbox.hide();
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !visible.value) return;
  e.stopPropagation();
  if (reading.value) closeLetter();
  else close();
}

function measure() {
  narrow.value = window.innerWidth < 620;
}

watch(visible, (on) => {
  document.body.classList.toggle('og-locked-scroll', on);
  if (on) {
    phase.value = 'closed';
    reading.value = null;
    measure();
    void nextTick(() => closeRef.value?.focus({ preventScroll: true }));
  }
});

onMounted(() => {
  measure();
  window.addEventListener('resize', measure);
  // Перехватываем Esc раньше страницы адвента: сначала закрывается коробка
  window.addEventListener('keydown', onKey, true);
  void mailbox.refresh();
});

onBeforeUnmount(() => {
  clearTimers();
  window.removeEventListener('resize', measure);
  window.removeEventListener('keydown', onKey, true);
  document.body.classList.remove('og-locked-scroll');
});
</script>

<style scoped>
.ogmb {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 26px 16px 32px;
  overflow: auto;
  background: radial-gradient(120% 80% at 50% 0%, #64101d 0%, #3a0911 60%, #1c0307 100%);
  animation: ogmb-in 0.3s ease;
}

@keyframes ogmb-in {
  from { opacity: 0; }
}

.ogmb__x {
  position: absolute;
  right: 16px;
  top: 14px;
  z-index: 1;
  font-family: var(--og-pixel);
  font-size: 9px;
  padding: 9px 11px;
  background: transparent;
  color: #ffd9d6;
  border: 2px solid var(--og-line);
  cursor: pointer;
}

.ogmb__head { text-align: center; padding-top: 26px; }

.ogmb__head h2 {
  margin: 0;
  font-family: var(--og-pixel);
  font-size: clamp(16px, 3.4vw, 26px);
  font-weight: 400;
  line-height: 1.4;
  color: var(--og-gold);
  text-shadow: 0 0 18px rgba(255, 207, 74, 0.5), 3px 3px 0 #6b2a00;
}

.ogmb__head p { margin: 10px 0 0; color: #f6d9d6; font-size: 17px; }

.ogmb__scene {
  flex: 1;
  width: 100%;
  max-width: 980px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
}

.ogmb__box {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  filter: drop-shadow(8px 10px 0 rgba(28, 3, 7, 0.55));
  transition: transform 0.5s ease;
}

.ogmb__box:disabled { cursor: default; }

.ogmb__scene.is-closed .ogmb__box { animation: ogmb-wiggle 2.6s ease-in-out infinite; }

/* Коробка нетерпеливо подрагивает */
@keyframes ogmb-wiggle {
  0%, 70%, 100% { transform: rotate(0); }
  76% { transform: rotate(-3deg); }
  84% { transform: rotate(3deg) translateY(-4px); }
  92% { transform: rotate(-2deg); }
}

.ogmb__lid { transition: transform 0.65s cubic-bezier(0.3, 0.7, 0.4, 1), opacity 0.65s ease; }

.ogmb__scene.is-opening .ogmb__lid,
.ogmb__scene.is-open .ogmb__lid {
  transform: translate(70px, -150px) rotate(26deg);
  opacity: 0;
}

/* Открытая коробка уезжает вниз и остаётся под письмами */
.ogmb__scene.is-open .ogmb__box { transform: scale(0.7); }
.ogmb__scene.is-open .ogmb__lid { height: 0; }

.ogmb__hint { margin: 0; font-family: var(--og-pixel); font-size: 10px; color: var(--og-gold-soft); }

.ogmb__letters {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px 18px;
  padding: 8px 0;
}

.ogmb__env {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  transform: rotate(var(--tilt));
  filter: drop-shadow(5px 7px 0 rgba(28, 3, 7, 0.5));
  transition: transform 0.2s ease;
  animation: ogmb-rise 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.1) backwards;
  animation-delay: calc(var(--i) * 70ms);
}

@keyframes ogmb-rise {
  from { transform: translateY(240px) rotate(0) scale(0.6); opacity: 0; }
}

.ogmb__env:hover { transform: rotate(0) translateY(-6px); }
.ogmb__env.is-read { filter: drop-shadow(5px 7px 0 rgba(28, 3, 7, 0.5)) saturate(0.75) brightness(0.86); }
.ogmb__env.is-hidden { visibility: hidden; }

/* ——— чтение ——— */
.ogmb__read {
  position: fixed;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  padding: 16px;
  overflow: auto;
  background: rgba(28, 3, 7, 0.72);
}

/* Запас сверху: лист и поднятый клапан уходят выше конверта */
.ogmb__fly { padding-top: 120px; filter: drop-shadow(8px 10px 0 rgba(28, 3, 7, 0.55)); }

.ogmb__paper {
  position: relative;
  box-sizing: border-box;
  width: min(480px, 100%);
  min-height: min(640px, 86vh);
  padding: clamp(36px, 9vw, 60px) clamp(28px, 7vw, 52px) clamp(28px, 6vw, 44px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-size: 100% 100%;
  image-rendering: pixelated;
  color: #3a2016;
  --ogmb-ink-font: 'Pixelify Sans', var(--og-pixel);
  --ogmb-hand-font: 'Neucha', var(--og-body);
  /* Тень по неровному краю листа, а не по прямоугольнику */
  filter: drop-shadow(7px 9px 0 rgba(28, 3, 7, 0.6));
  animation: ogmb-unfold 0.45s cubic-bezier(0.2, 0.9, 0.3, 1);
}

@keyframes ogmb-unfold {
  from { transform: translateY(70px) scale(0.72); opacity: 0.4; }
}

.ogmb__paper h3 {
  margin: 0;
  padding-bottom: 6px;
  font-family: var(--ogmb-ink-font);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.1;
  color: #7d1f28;
  /* Подчёркнуто от руки: пунктир, как перо по шершавой бумаге */
  border-bottom: 3px dashed rgba(125, 31, 40, 0.45);
  align-self: flex-start;
}

.ogmb__text {
  margin: 0;
  flex: 1;
  font-family: var(--ogmb-hand-font);
  font-size: 25px;
  line-height: 1.35;
  /* Тёмные чернила: письмо прежде всего читают */
  color: #2a1610;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ogmb__sign {
  margin: 0;
  text-align: right;
  font-family: var(--ogmb-hand-font);
  font-size: 21px;
  color: #5a3a26;
}

.ogmb__fold {
  align-self: center;
  font-family: var(--ogmb-hand-font);
  font-size: 20px;
  padding: 10px 12px;
  background: transparent;
  color: #7d1f28;
  border: 2px solid #9c6516;
  cursor: pointer;
}

@media (max-width: 620px) {
  .ogmb__text { font-size: 22px; }
  .ogmb__paper h3 { font-size: 28px; }
}

@media (prefers-reduced-motion: reduce) {
  .ogmb, .ogmb__env, .ogmb__paper, .ogmb__scene.is-closed .ogmb__box { animation: none; }
  .ogmb__box, .ogmb__lid, .ogmb__env { transition: none; }
}
</style>
