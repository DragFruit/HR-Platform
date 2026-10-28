<template>
  <div v-if="enabled" class="hw-layer" aria-hidden="true">
    <!--
      Тыква живёт на полосе подвала, а не на вьюпорте: полоса во всю ширину
      экрана накрывала сайдбар и садилась прямо на кнопку «Выйти».
    -->
    <Teleport v-if="spotX !== null && !gone" to=".app-site-footer">
      <div class="hw-pumpkins">
        <button
          type="button"
          class="hw-pumpkin"
          :class="{ 'is-broken': broken }"
          :style="{ left: `${spotX}%`, '--hw-scale': String(PUMPKIN.scale), '--hw-ratio': String(ratio) }"
          :tabindex="-1"
          @click="breakPumpkin"
        >
          <img
            v-if="!broken"
            class="hw-pumpkin__whole"
            :src="art()"
            alt=""
            draggable="false"
          />
          <template v-else>
            <img class="hw-pumpkin__half hw-pumpkin__half--l" :src="art('-left')" alt="" draggable="false" />
            <img class="hw-pumpkin__half hw-pumpkin__half--r" :src="art('-right')" alt="" draggable="false" />
          </template>
        </button>
      </div>
    </Teleport>

    <div v-if="motionAllowed" class="hw-ghosts">
      <img
        v-for="g in GHOSTS"
        :key="g.id"
        class="hw-ghost"
        :src="GHOST_SRC"
        alt=""
        draggable="false"
        :style="{
          top: `${g.top}%`,
          animationDuration: `${g.duration}s`,
          animationDelay: `${g.delay}s`,
          '--hw-ghost-scale': String(g.scale)
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Тыква в ведьминской шляпе и призраки.
 *
 * Тыква одна и садится в просвет между календарём и правой панелью — это
 * единственная полоса подвала, над которой ничего нет. Разломать её можно
 * кликом: половинки остаются лежать до конца захода, при следующем открытии
 * тыквы нет совсем, а через двое суток она вырастает заново.
 *
 * Состояние держим в браузере: это косметика, ради неё не стоит нагружать
 * сервер. Плата честная — на другом устройстве тыква снова целая.
 */
const GHOST_SRC = '/decor/halloween/ghost.png';

const PUMPKIN = { id: 'witch', src: 'pumpkin-witch', ratio: 0.96, scale: 1 } as const;

const art = (part: '' | '-left' | '-right' = '') =>
  `/decor/halloween/${PUMPKIN.src}${part}.png`;
const ratio = PUMPKIN.ratio;

const PUMPKIN_REGROW_MS = 2 * 24 * 60 * 60 * 1000;
const PUMPKINS_KEY = 'vbi-halloween-pumpkins';

const GHOSTS = [
  { id: 'g1', top: 24, duration: 54, delay: 0, scale: 1 },
  { id: 'g2', top: 58, duration: 73, delay: 18, scale: 0.72 }
] as const;

const { enabled, motionAllowed } = useHalloweenDecor();
const route = useRoute();

/** id → когда сломали (ISO). */
const brokenAt = ref<Record<string, string>>({});
/** Сломана прямо сейчас — только тогда показываем половинки. */
const brokenNow = ref(false);

/** Сломана раньше и ещё не выросла — тыквы нет совсем. */
const gone = computed(() => Boolean(brokenAt.value[PUMPKIN.id]) && !brokenNow.value);
const broken = computed(() => brokenNow.value);

function readBroken(): Record<string, string> {
  if (!import.meta.client) return {};
  try {
    const raw = JSON.parse(localStorage.getItem(PUMPKINS_KEY) || '{}');
    if (!raw || typeof raw !== 'object') return {};
    const now = Date.now();
    const kept: Record<string, string> = {};
    for (const [id, at] of Object.entries(raw as Record<string, string>)) {
      const ms = Date.parse(String(at));
      // Выросла заново — запись больше не нужна.
      if (Number.isFinite(ms) && now - ms < PUMPKIN_REGROW_MS) kept[id] = String(at);
    }
    return kept;
  } catch {
    return {};
  }
}

function persist() {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(PUMPKINS_KEY, JSON.stringify(brokenAt.value));
  } catch {
    /* приватный режим — тыква просто восстановится при перезагрузке */
  }
}

function breakPumpkin() {
  if (brokenNow.value) return;
  brokenAt.value = { ...brokenAt.value, [PUMPKIN.id]: new Date().toISOString() };
  brokenNow.value = true;
  persist();
}

/**
 * Место тыквы — середина просвета между колонкой календаря и правой панелью,
 * в процентах ширины подвала. Считаем по живой разметке, а не по магическому
 * числу: ширина колонок зависит от экрана. Нет панели (другой раздел) — нет
 * и тыквы.
 */
const ASIDE_SELECTOR = '.employee-aside-shell, .vac-manager-aside-panel';
const spotX = ref<number | null>(null);

function measureSpot() {
  if (!import.meta.client) return;
  const aside = document.querySelector(ASIDE_SELECTOR);
  const footer = document.querySelector('.app-site-footer');
  if (!aside || !footer) {
    spotX.value = null;
    return;
  }
  const a = aside.getBoundingClientRect();
  const f = footer.getBoundingClientRect();
  if (!a.width || !f.width) {
    spotX.value = null;
    return;
  }
  /*
   * Левый край просвета — правый край последней карточки месяца: сетка
   * месяцев уже карточки, и между ней и панелью остаётся пустая полоса.
   * Нет карточек (другой вид календаря) — берём колонку целиком.
   */
  const cards = document.querySelectorAll('.emp-cal-month');
  const lastCard = cards.length ? cards[cards.length - 1]!.getBoundingClientRect() : null;
  const column = aside.previousElementSibling?.getBoundingClientRect();
  const left = lastCard && lastCard.right < a.left ? lastCard.right : column?.right;
  const gapLeft = left && left < a.left ? left : a.left - 24;
  spotX.value = (((gapLeft + a.left) / 2 - f.left) / f.width) * 100;
}

/*
 * Раздел дорисовывается не сразу: сперва восстановление сессии, потом данные.
 * Высота страницы при этом не меняется (экран во весь вьюпорт), поэтому на
 * ResizeObserver полагаться нельзя — перемеряем с запасом, пока панель не
 * появится. Постоянного наблюдателя за DOM ради декора заводить не хочется.
 */
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleMeasure(attempts = 24) {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  // Без requestAnimationFrame: в фоновой вкладке кадры не идут, и тыква
  // не появилась бы до первого ресайза.
  nextTick(() => {
    measureSpot();
    if (spotX.value === null && attempts > 0) {
      retryTimer = setTimeout(() => scheduleMeasure(attempts - 1), 500);
    }
  });
}

let observer: ResizeObserver | null = null;

onMounted(() => {
  brokenAt.value = readBroken();
  brokenNow.value = false;
  persist();
  scheduleMeasure();
  window.addEventListener('resize', measureSpot);
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measureSpot());
    observer.observe(document.body);
  }
});

onBeforeUnmount(() => {
  if (!import.meta.client) return;
  window.removeEventListener('resize', measureSpot);
  if (retryTimer) clearTimeout(retryTimer);
  observer?.disconnect();
});

watch(() => route.fullPath, () => scheduleMeasure());
watch(enabled, () => scheduleMeasure());
</script>
