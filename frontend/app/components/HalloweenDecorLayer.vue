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
          <!--
            v-show, а не v-if: обе картинки грузятся вместе с тыквой, и разлом
            появляется в тот же миг, что и клик. С v-if браузер шёл за
            картинкой только после клика — тыква «думала» секунду-две.
          -->
          <img
            v-show="!broken"
            class="hw-pumpkin__whole"
            :src="art()"
            alt=""
            draggable="false"
          />
          <img v-show="broken" class="hw-pumpkin__broken" :src="BROKEN_SRC" alt="" draggable="false" />
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
 * кликом: разлом лежит до конца захода, при следующем открытии тыквы нет
 * совсем, а через двое суток она вырастает заново.
 *
 * Состояние держим в браузере: это косметика, ради неё не стоит нагружать
 * сервер. Плата честная — на другом устройстве тыква снова целая.
 */
const GHOST_SRC = '/decor/halloween/ghost.png';

const PUMPKIN = { id: 'witch', src: 'pumpkin-witch', ratio: 0.96, scale: 1 } as const;

const art = () => `/decor/halloween/${PUMPKIN.src}.png`;
/** Разлом — отдельный рисунок заказчика, а не половинки целой тыквы. */
const BROKEN_SRC = '/decor/halloween/pumpkin-broken.png';
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
  const candidates = [lastCard?.right, column?.right].filter(
    (x): x is number => typeof x === 'number' && x < a.left
  );
  /*
   * На узком окне панель уезжает под календарь — просвета нет совсем, и
   * тыкве негде сесть: раньше она в этом случае оказывалась под сайдбаром.
   * Нет щели шире 8px — нет и тыквы.
   */
  const gapLeft = candidates.length ? Math.max(...candidates) : null;
  if (gapLeft === null || a.left - gapLeft < 8) {
    spotX.value = null;
    return;
  }
  spotX.value = (((gapLeft + a.left) / 2 - f.left) / f.width) * 100;
}

/*
 * Кот в сетке дней меряется по живой клетке, а не по магическим числам.
 *
 * Высота: клетка дня всего 28px, и кот ростом 34px залезал ушами на строку
 * сверху. Берём высоту клетки плюс 2px на зазор между клетками.
 *
 * Ширина: тело тайлится, и доля должна давать целое число повторов, иначе
 * рисунок рвётся на границе клеток. Один повтор на всю клетку растягивал кота
 * вдвое. Медиазапросами это не решается: ширина клетки зависит не от окна, а
 * от того, сколько карточек месяцев встало в ряд — от 20 до 48px.
 */
const CAT_BODY_RATIO = 107 / 150;
const CAT_OVERHANG = 2;

function measureCatTile() {
  if (!import.meta.client) return;
  const rect = document.querySelector('.hr-month-grid td')?.getBoundingClientRect();
  if (!rect?.width || !rect.height) return;
  const maxH = Math.round(rect.height) + CAT_OVERHANG;
  /*
   * Высота кота — по ряду: голова, хвост и тело должны быть одного роста с
   * полосой отпуска, иначе кот перестаёт читаться.
   *
   * Ширина плитки задана клеткой, делённой на целое число повторов, поэтому
   * тело всё равно немного тянется или поджимается. Из двух соседних целых
   * берём то, где искажение меньше.
   */
  const natural = maxH * CAT_BODY_RATIO;
  /*
   * Повторов берём меньше, а не больше: кот чуть длиннее натурального читается
   * как кот, а поджатый в три раза — как частокол из лап. Тянуть больше чем на
   * треть уже нельзя, тогда добавляем повтор.
   */
  let times = Math.max(1, Math.floor(rect.width / natural));
  if (rect.width / times / natural > 1.35) times += 1;
  /*
   * Клетка заметно уже кота (узкие высокие клетки на широком экране) —
   * повторов меньше одного не бывает, поэтому опускаем самого кота: лучше
   * ниже ряда, чем сплющенный вдоль.
   */
  const tileW = rect.width / times;
  const h = tileW / (maxH * CAT_BODY_RATIO) < 0.8 ? tileW / CAT_BODY_RATIO : maxH;
  const style = document.documentElement.style;
  style.setProperty('--hw-cat-h', `${Math.round(h)}px`);
  style.setProperty('--hw-cat-tile', `${(100 / times).toFixed(4)}%`);
}

const remeasure = () => {
  measureSpot();
  measureCatTile();
};

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
    remeasure();
    // Повторяем, пока не нашлись оба якоря: панель (место тыквы) и клетка дня
    // (доля плитки кота). Они появляются в разные моменты.
    const done = spotX.value !== null && Boolean(document.querySelector('.hr-month-grid td'));
    if (!done && attempts > 0) {
      retryTimer = setTimeout(() => scheduleMeasure(attempts - 1), 500);
    }
  });
}

let observer: ResizeObserver | null = null;
/*
 * Календарь сотрудника открывается и без смены маршрута — тумблером
 * «Руководитель / Сотрудник». Тогда ни route, ни высота страницы не меняются,
 * и кот оставался с замером от прошлого вида: растянутый вдвое. Поэтому
 * слушаем перерисовку разметки, но считаем не чаще раза в 200мс.
 */
let domObserver: MutationObserver | null = null;
let domTimer: ReturnType<typeof setTimeout> | null = null;

function onDomChanged() {
  if (domTimer) return;
  domTimer = setTimeout(() => {
    domTimer = null;
    remeasure();
  }, 200);
}

onMounted(() => {
  brokenAt.value = readBroken();
  brokenNow.value = false;
  persist();
  scheduleMeasure();
  window.addEventListener('resize', remeasure);
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(remeasure);
    observer.observe(document.body);
  }
  if (typeof MutationObserver !== 'undefined') {
    domObserver = new MutationObserver(onDomChanged);
    domObserver.observe(document.body, { childList: true, subtree: true });
  }
});

onBeforeUnmount(() => {
  if (!import.meta.client) return;
  window.removeEventListener('resize', remeasure);
  if (retryTimer) clearTimeout(retryTimer);
  if (domTimer) clearTimeout(domTimer);
  observer?.disconnect();
  domObserver?.disconnect();
});

watch(() => route.fullPath, () => scheduleMeasure());
watch(enabled, () => scheduleMeasure());
</script>
