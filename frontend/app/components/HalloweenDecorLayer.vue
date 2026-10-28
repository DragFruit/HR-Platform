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
 * Кот в сетке дней. Отрезок подряд идущих дней отпуска внутри строки недели
 * рисуется одним элементом поверх карточки месяца: голова, целое число
 * повторов тела, хвост.
 *
 * Ширины подбираем так, чтобы части уложились в отрезок без остатка и в одном
 * масштабе. Подгонять каждую часть под ширину дня нельзя: части разной ширины
 * (97, 107 и 177 пикселей в исходниках), масштабы выходили разные, полоски на
 * стыке не совпадали, а последней плитке тела срезало лапу.
 *
 * По клетке рисовать тоже нельзя: клетка дробной ширины, каждый фон
 * округляется до пикселей сам по себе, и на границах дней оставались белые
 * нитки.
 */
const CAT_H = 34;
const HEAD_SRC = 97;
const BODY_SRC = 107;
const TAIL_SRC = 177;

type CatParts = { head: number; body: number; tail: number };
type CatRun = {
  left: number;
  top: number;
  width: number;
  head: boolean;
  tail: boolean;
  parts: CatParts;
};

/**
 * Ширины частей в пикселях. Повторов тела берём столько, чтобы тело вышло
 * ближе всего к ширине дня, а масштаб подгоняем под длину отрезка.
 */
function catParts(width: number, dayWidth: number, head: boolean, tail: boolean): CatParts {
  const ends = ((head ? HEAD_SRC : 0) + (tail ? TAIL_SRC : 0)) / BODY_SRC;
  const times = Math.max(head || tail ? 0 : 1, Math.round(width / dayWidth - ends));
  const body = width / (times + ends);
  return {
    head: head ? (body * HEAD_SRC) / BODY_SRC : 0,
    body,
    tail: tail ? (body * TAIL_SRC) / BODY_SRC : 0
  };
}

function collectRuns(table: Element): CatRun[] {
  const runs: CatRun[] = [];
  for (const row of table.querySelectorAll('tr')) {
    const cells = Array.from(row.children) as HTMLElement[];
    let i = 0;
    while (i < cells.length) {
      if (!cells[i]!.classList.contains('emp-day-pending')) {
        i += 1;
        continue;
      }
      let last = i;
      while (last + 1 < cells.length && cells[last + 1]!.classList.contains('emp-day-pending')) {
        last += 1;
      }
      const from = cells[i]!;
      const to = cells[last]!;
      const head = from.classList.contains('emp-pend-run-start');
      const tail = to.classList.contains('emp-pend-run-end');
      /*
       * offsetLeft/offsetTop, а не getBoundingClientRect: это координаты
       * вёрстки относительно слоя, они не зависят от масштаба страницы и не
       * требуют вычитать прокрутку.
       */
      const width = to.offsetLeft + to.offsetWidth - from.offsetLeft;
      runs.push({
        left: from.offsetLeft,
        top: from.offsetTop + from.offsetHeight + 1 - CAT_H,
        width,
        head,
        tail,
        parts: catParts(width, from.offsetWidth, head, tail)
      });
      i = last + 1;
    }
  }
  return runs;
}

function layoutCatRuns() {
  if (!import.meta.client) return;
  // Слизь по-прежнему рисуется по клетке, ей нужна ширина клетки в пикселях.
  const cellWidth = document.querySelector('.hr-month-grid td')?.getBoundingClientRect().width;
  if (cellWidth) {
    document.documentElement.style.setProperty('--hw-cell', `${cellWidth.toFixed(2)}px`);
  }
  for (const table of document.querySelectorAll('.hr-month-grid')) {
    const host = table.parentElement as HTMLElement | null;
    if (!host) continue;
    let layer = host.querySelector(':scope > .hw-cat-layer') as HTMLElement | null;
    const hasDays = enabled.value && Boolean(table.querySelector('td.emp-day-pending'));
    if (!hasDays) {
      layer?.remove();
      continue;
    }
    // Слой должен стать точкой отсчёта до того, как читаем offsetLeft клеток.
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'hw-cat-layer';
      layer.setAttribute('aria-hidden', 'true');
      host.appendChild(layer);
    }
    const runs = collectRuns(table);
    // Своя же правка разметки будит MutationObserver — пишем, только если
    // геометрия и правда изменилась, иначе уйдём в бесконечный цикл.
    const key = JSON.stringify(runs);
    if (layer.dataset.runs === key) continue;
    layer.dataset.runs = key;
    layer.replaceChildren(
      ...runs.map((run) => {
        const el = document.createElement('div');
        el.className = [
          'hw-cat-run',
          run.head ? 'hw-cat-head' : '',
          run.tail ? 'hw-cat-tail' : ''
        ]
          .filter(Boolean)
          .join(' ');
        el.style.left = `${run.left}px`;
        el.style.top = `${run.top}px`;
        el.style.width = `${run.width}px`;
        el.style.setProperty('--hw-head', `${run.parts.head.toFixed(3)}px`);
        el.style.setProperty('--hw-body', `${run.parts.body.toFixed(3)}px`);
        el.style.setProperty('--hw-tail', `${run.parts.tail.toFixed(3)}px`);
        return el;
      })
    );
  }
}

function dropCatRuns() {
  if (!import.meta.client) return;
  for (const layer of document.querySelectorAll('.hw-cat-layer')) layer.remove();
}

const remeasure = () => {
  measureSpot();
  layoutCatRuns();
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
  dropCatRuns();
});

watch(() => route.fullPath, () => scheduleMeasure());
watch(enabled, () => scheduleMeasure());
</script>
