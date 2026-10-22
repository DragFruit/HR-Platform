<template>
  <div
    v-if="isActive && giftSet"
    class="tenure-celeb"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="phase === 'letter' ? 'tenure-celeb-title' : undefined"
  >
    <div class="tenure-celeb__scrim" aria-hidden="true" />

    <!-- Письмо-поздравление -->
    <article v-if="phase === 'letter'" class="tenure-celeb__card tenure-celeb__letter">
      <p class="tenure-celeb__eyebrow">Юбилей в компании</p>
      <div class="tenure-celeb__years" aria-hidden="true">{{ giftSet.years }}</div>
      <h2 id="tenure-celeb-title" class="tenure-celeb__title">
        {{ yearsHeadline }}
      </h2>
      <p class="tenure-celeb__lead">
        {{ firstName }}, сегодня особенный день — ты с нами уже
        <strong>{{ giftSet.years }} {{ yearsWord }}</strong>.
        Спасибо за вклад, характер и то, что делаешь команду сильнее.
      </p>
      <p class="tenure-celeb__body muted">
        Впереди — знак признания, ачивка и юбилейный набор: медаль «{{ giftSet.medalLabel }}»,
        вино {{ giftSet.wineYears }} лет выдержки и премия {{ bonusLabel }}.
      </p>
      <button ref="ctaRef" class="button primary tenure-celeb__cta" type="button" @click="onLetterCta">
        Горжусь быть частью команды
      </button>
    </article>

    <!-- Ачивка -->
    <div
      v-else-if="phase === 'achievement'"
      class="tenure-celeb__reward"
      role="dialog"
      aria-labelledby="tenure-ach-title"
    >
      <div class="tenure-celeb__medal" :data-years="giftSet.years" aria-hidden="true">
        <span class="tenure-celeb__medal-ring" />
        <span class="tenure-celeb__medal-num">{{ giftSet.years }}</span>
        <span class="tenure-celeb__medal-cap">лет</span>
      </div>
      <h2 id="tenure-ach-title" class="tenure-celeb__reward-title">Ачивка получена</h2>
      <p class="tenure-celeb__reward-sub">«{{ giftSet.medalLabel }} в VBI»</p>
      <button class="button primary" type="button" @click="advanceFromAchievement">Дальше</button>
    </div>

    <!-- Подарок -->
    <div v-else-if="phase === 'gift'" class="tenure-celeb__gift-stage">
      <p class="tenure-celeb__eyebrow">Тебе подарок</p>
      <button
        type="button"
        class="tenure-celeb__box"
        aria-label="Открыть подарок"
        @click="onOpenGift"
      >
        <span class="tenure-celeb__box-lid" aria-hidden="true" />
        <span class="tenure-celeb__box-body" aria-hidden="true" />
        <span class="tenure-celeb__box-bow" aria-hidden="true" />
      </button>
      <p class="muted tenure-celeb__hint">Нажми на коробку</p>
    </div>

    <!-- Купон -->
    <article
      v-else-if="phase === 'coupon'"
      class="tenure-celeb__coupon"
      :data-years="giftSet.years"
      role="dialog"
      aria-labelledby="tenure-coupon-title"
    >
      <p class="tenure-celeb__coupon-stamp">Купон</p>
      <h2 id="tenure-coupon-title" class="tenure-celeb__coupon-title">{{ giftSet.couponTitle }}</h2>
      <ul class="tenure-celeb__coupon-list list-reset">
        <li>Медаль «{{ giftSet.medalLabel }}» в рамке</li>
        <li>Вино {{ giftSet.wineYears }} лет выдержки</li>
        <li>Премия {{ bonusLabel }}</li>
      </ul>
      <p class="tenure-celeb__coupon-note muted">
        Набор появится в магазине — можно сразу перейти и использовать купон.
      </p>
      <div class="tenure-celeb__coupon-actions">
        <button class="button primary" type="button" @click="goStore">В магазин</button>
        <button class="button ghost" type="button" @click="finish">Позже</button>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
type ConfettiFn = (options: {
  position: { x: number; y: number };
  count: number;
  velocity: number;
}) => void;

let confettiFn: ConfettiFn | null = null;

const loadConfetti = async (): Promise<ConfettiFn | null> => {
  if (!import.meta.client) return null;
  if (!confettiFn) {
    confettiFn = await importConfetti();
  }
  return confettiFn;
};

const { user } = useAuth();
const {
  phase,
  giftSet,
  isActive,
  evaluate,
  advanceFromLetter,
  advanceFromAchievement,
  openGift,
  finish
} = useTenureCelebration();

const ctaRef = ref<HTMLButtonElement | null>(null);
const employeesHydrated = useState<boolean>('vbi-employees-hydrated');

const firstName = computed(() => {
  const name = user.value?.name?.trim() || '';
  const part = name.split(/\s+/)[0];
  return part || 'коллега';
});

const yearsWord = computed(() => {
  const y = giftSet.value?.years ?? 0;
  if (y === 1) return 'год';
  if (y >= 2 && y <= 4) return 'года';
  return 'лет';
});

const yearsHeadline = computed(() => {
  const y = giftSet.value?.years ?? 0;
  return `${y} ${yearsWord.value} вместе`;
});

const bonusLabel = computed(() => {
  const n = giftSet.value?.bonusRub ?? 0;
  return `${n.toLocaleString('ru-RU')} ₽`;
});

const burst = async (x: number, y: number, count: number, velocity: number) => {
  const confetti = await loadConfetti();
  if (!confetti) return;
  confetti({ position: { x, y }, count, velocity });
};

const onLetterCta = async () => {
  const btn = ctaRef.value;
  const x = btn ? btn.getBoundingClientRect().left + btn.offsetWidth / 2 : window.innerWidth * 0.5;
  const y = btn ? btn.getBoundingClientRect().top + btn.offsetHeight / 2 : window.innerHeight * 0.55;
  await burst(x, y, 140, 230);
  window.setTimeout(() => void burst(window.innerWidth * 0.3, window.innerHeight * 0.4, 70, 180), 180);
  window.setTimeout(() => void burst(window.innerWidth * 0.7, window.innerHeight * 0.4, 70, 180), 360);
  advanceFromLetter();
};

const onOpenGift = async () => {
  await burst(window.innerWidth * 0.5, window.innerHeight * 0.45, 100, 200);
  openGift();
};

const goStore = async () => {
  finish();
  await navigateTo('/store');
};

watch(
  [() => user.value?.id, employeesHydrated],
  () => {
    if (employeesHydrated.value) evaluate();
  },
  { immediate: true }
);

onMounted(() => {
  if (employeesHydrated.value) evaluate();
});
</script>
