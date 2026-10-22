<script setup lang="ts">
type MobileNavIconId = 'knowledge' | 'vacation' | 'home' | 'ideas' | 'store';

type Tab = {
  to: string;
  label: string;
  icon: MobileNavIconId;
  center?: boolean;
};

const props = withDefaults(
  defineProps<{ mode?: 'employee' | 'admin' }>(),
  { mode: 'employee' }
);

const { isNavPathUnlocked } = useLaunchScope();
const { claim, release } = useBottomRightSlot();
const route = useRoute();

const MOBILE_DOCK_MQ = '(max-width: 900px)';
let dockMq: MediaQueryList | null = null;

const syncDockSlot = () => {
  if (typeof window === 'undefined') return;
  if (window.matchMedia(MOBILE_DOCK_MQ).matches) {
    claim(BOTTOM_RIGHT_SLOT.mobileDock);
  } else {
    release(BOTTOM_RIGHT_SLOT.mobileDock);
  }
};

const barRef = ref<HTMLElement | null>(null);
const itemRefs = new Map<string, HTMLElement>();
const orbReady = ref(false);
/** Первое появление — без анимации (кружок не «прилетает» из угла). */
const orbInstant = ref(true);
const orbX = ref(0);
const orbY = ref(0);
const orbScale = ref(1);
/** Кружок одного размера (40), меньшие пункты — scale: анимируется только transform. */
const ORB_SIZE = 40;

const setItemRef = (to: string, el: unknown) => {
  const node =
    el instanceof HTMLElement
      ? el
      : el && typeof el === 'object' && '$el' in el && (el as { $el: unknown }).$el instanceof HTMLElement
        ? ((el as { $el: HTMLElement }).$el as HTMLElement)
        : null;
  if (node) itemRefs.set(to, node);
  else itemRefs.delete(to);
};

const employeeTabs: Tab[] = [
  { to: '/knowledge', label: 'База знаний', icon: 'knowledge' },
  { to: '/vacations', label: 'Отпуск', icon: 'vacation' },
  { to: '/', label: 'Главная', icon: 'home', center: true },
  { to: '/ideas', label: 'Банк идей', icon: 'ideas' },
  { to: '/store', label: 'Магазин', icon: 'store' }
];

const adminTabs: Tab[] = [
  { to: '/admin/knowledge', label: 'Знания', icon: 'knowledge' },
  { to: '/admin/vacations', label: 'Отпуск', icon: 'vacation' },
  { to: '/admin', label: 'Панель', icon: 'home', center: true },
  { to: '/admin/ideas', label: 'Идеи', icon: 'ideas' },
  { to: '/admin/employees', label: 'Люди', icon: 'store' }
];

const tabs = computed(() => (props.mode === 'admin' ? adminTabs : employeeTabs));

const lockedHint = 'Раздел скоро откроется';

const isLocked = (to: string) => !isNavPathUnlocked(to);

/**
 * Пункт, по которому только что тапнули: подсветка и кружок едут сразу, не дожидаясь
 * загрузки страницы (иначе анимация запаздывала и накладывалась на переход страницы).
 */
const pendingTo = ref<string | null>(null);
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/** null — текущего раздела нет в доке: ничего не подсвечиваем (раньше падало на первый пункт). */
const routeTab = computed(() => findActiveDockItem(tabs.value, route.path));
const activeTab = computed(
  () => (pendingTo.value ? tabs.value.find((t) => t.to === pendingTo.value) : null) ?? routeTab.value
);

const isActive = (to: string) => (activeTab.value ? activeTab.value.to === to : isDockItemActive(to, route.path));

const onItemTap = (to: string) => {
  if (activeTab.value?.to === to) return;
  pendingTo.value = to;
  if (pendingTimer) clearTimeout(pendingTimer);
  // Переход не состоялся (ошибка, отмена) — вернёмся к фактическому разделу
  pendingTimer = setTimeout(() => {
    pendingTo.value = null;
  }, 2500);
};

const orbStyle = computed(() => ({
  transform: `translate3d(${orbX.value - ORB_SIZE / 2}px, ${orbY.value - ORB_SIZE / 2}px, 0) scale(${orbScale.value})`
}));

/** Позиция по layout (offset*), а не getBoundingClientRect: transform иконки не сбивает расчёт. */
const updateOrb = () => {
  const bar = barRef.value;
  const tab = activeTab.value;
  if (!bar) return;
  if (!tab) {
    orbReady.value = false;
    return;
  }
  const el = itemRefs.get(tab.to);
  if (!el) return;
  const icon = el.querySelector('.mob-dock__icon') as HTMLElement | null;
  if (!icon || !el.offsetWidth) return;

  orbX.value = el.offsetLeft + icon.offsetLeft + icon.offsetWidth / 2;
  orbY.value = el.offsetTop + icon.offsetTop + icon.offsetHeight / 2;
  orbScale.value = tab.center ? 1 : 0.75;
  if (!orbReady.value) {
    orbInstant.value = true;
    orbReady.value = true;
    requestAnimationFrame(() => requestAnimationFrame(() => (orbInstant.value = false)));
  }
};

let resizeObs: ResizeObserver | null = null;

onMounted(() => {
  dockMq = window.matchMedia(MOBILE_DOCK_MQ);
  syncDockSlot();
  dockMq.addEventListener('change', syncDockSlot);

  nextTick(() => {
    updateOrb();
    if (barRef.value) {
      resizeObs = new ResizeObserver(() => updateOrb());
      resizeObs.observe(barRef.value);
    }
  });
  window.addEventListener('resize', updateOrb);
});

onBeforeUnmount(() => {
  dockMq?.removeEventListener('change', syncDockSlot);
  release(BOTTOM_RIGHT_SLOT.mobileDock);
  resizeObs?.disconnect();
  window.removeEventListener('resize', updateOrb);
  if (pendingTimer) clearTimeout(pendingTimer);
});

watch(
  () => [route.path, props.mode] as const,
  async () => {
    pendingTo.value = null;
    if (pendingTimer) clearTimeout(pendingTimer);
    await nextTick();
    if (typeof document !== 'undefined') {
      const ae = document.activeElement;
      if (ae instanceof HTMLElement && ae.closest('.mob-dock')) {
        ae.blur();
      }
    }
    updateOrb();
  }
);

// Тап — кружок едет сразу (активный пункт сменился раньше маршрута)
watch(
  () => activeTab.value?.to,
  () => {
    void nextTick(updateOrb);
  }
);
</script>

<template>
  <nav class="mob-dock" aria-label="Основное меню">
    <div ref="barRef" class="mob-dock__bar">
      <div
        class="mob-dock__orb"
        :class="{ 'is-ready': orbReady && !!activeTab, 'is-instant': orbInstant, 'is-center': !!activeTab?.center, 'is-locked-target': activeTab && isLocked(activeTab.to) }"
        :style="orbStyle"
        aria-hidden="true"
      />

      <template v-for="tab in tabs" :key="tab.to">
        <NuxtLink
          v-if="!isLocked(tab.to)"
          :ref="(el) => setItemRef(tab.to, el)"
          :to="tab.to"
          class="mob-dock__item"
          :class="{ 'is-on': isActive(tab.to), 'is-center': !!tab.center }"
          :aria-current="isActive(tab.to) ? 'page' : undefined"
          @click="onItemTap(tab.to)"
        >
          <span class="mob-dock__icon">
            <AppMobileNavIcon :name="tab.icon" />
          </span>
          <span class="mob-dock__label">{{ tab.label }}</span>
        </NuxtLink>

        <span
          v-else
          :ref="(el) => setItemRef(tab.to, el)"
          class="mob-dock__item is-locked"
          :class="{ 'is-on': isActive(tab.to), 'is-center': !!tab.center }"
          role="link"
          aria-disabled="true"
          :aria-label="`${tab.label} — скоро`"
          :title="lockedHint"
        >
          <span class="mob-dock__icon">
            <AppMobileNavIcon :name="tab.icon" locked />
          </span>
          <span class="mob-dock__label">{{ tab.label }}</span>
        </span>
      </template>
    </div>
  </nav>
</template>

<style scoped>
.mob-dock {
  display: none;
}

@media (max-width: 900px) {
  .mob-dock {
    display: block;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    /* iOS HIG: таббар 49pt + safe-area; пилюля чуть заходит в зону home-индикатора */
    padding: 0 8px max(6px, calc(env(safe-area-inset-bottom, 0px) - 10px));
    pointer-events: none;
  }

  .mob-dock__bar {
    pointer-events: auto;
    position: relative;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: end;
    gap: 0;
    /* 49pt HIG + 3: подписи не прижаты к нижней кромке пилюли */
    height: 52px;
    min-height: 0;
    box-sizing: border-box;
    /* Подписи крайних пунктов не упираются в скругление пилюли */
    padding: 0 10px;
    align-items: center;
    border: 1.5px solid #111;
    border-radius: 22px;
    /* Серый внутри пилюли; снаружи .mob-dock без фона */
    background-color: #d8d8d4;
    background-image: none;
    box-shadow: 2px 2px 0 #111;
    overflow: visible;
  }

  /* Один кружок 40×40 едет между пунктами: только transform (translate + scale) —
   * композитится на GPU, без пересчёта раскладки; пружинистый ease без «отскока» назад. */
  .mob-dock__orb {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 0;
    width: 40px;
    height: 40px;
    box-sizing: border-box;
    border-radius: 999px;
    border: 2px solid #111;
    background-color: #7451f4;
    box-shadow: 2px 2px 0 #111;
    opacity: 0;
    pointer-events: none;
    transform-origin: 50% 50%;
    will-change: transform;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    transition:
      transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1),
      background-color 0.2s ease,
      opacity 0.16s ease;
  }

  .mob-dock__orb.is-instant {
    transition: none;
  }

  .mob-dock__orb.is-ready {
    opacity: 1;
  }

  .mob-dock__orb.is-center {
    background: #7451f4;
  }

  .mob-dock__orb:not(.is-center) {
    background: #ddf365;
  }

  .mob-dock__orb.is-locked-target {
    background: #9b86f0;
  }

  .mob-dock__item {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: 48px;
    min-height: 44px;
    min-width: 0;
    padding: 0;
    border-radius: 14px;
    color: #555;
    text-decoration: none;
    font-weight: 700;
    transition: color 0.2s ease;
    background: transparent;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }

  .mob-dock__item:focus,
  .mob-dock__item:focus-visible,
  .mob-dock__item:active {
    outline: none;
    box-shadow: none;
  }

  /* Центр — той же высоты, что соседи: подпись «Главная» целиком внутри дока,
   * крупнее только кружок (40) вокруг иконки */
  .mob-dock__icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    color: inherit;
    transform: translate3d(0, 0, 0);
    transition:
      transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1),
      color 0.2s ease;
  }

  .mob-dock__icon :deep(.mob-nav-ico) {
    width: 22px;
    height: 22px;
  }

  /* Иконка центра приподнята (кружок чуть выступает над доком), подпись — на одной линии с соседями */
  .mob-dock__item.is-center .mob-dock__icon {
    margin: -8px 0 8px;
  }

  /* Активная иконка чуть крупнее и приподнята — вместе с кружком, одной кривой */
  .mob-dock__item.is-on .mob-dock__icon {
    transform: translate3d(0, -1px, 0) scale(1.08);
  }

  .mob-dock__item.is-on.is-center .mob-dock__icon {
    transform: translate3d(0, -1px, 0) scale(1.04);
  }

  /* Нажатие: короткий отклик только у иконки (без второго «прыжка» всего пункта) */
  .mob-dock__item:active .mob-dock__icon {
    transform: translate3d(0, 0, 0) scale(0.92);
    transition-duration: 0.1s;
  }

  .mob-dock__item.is-center .mob-dock__icon :deep(.mob-nav-ico) {
    width: 24px;
    height: 24px;
  }

  .mob-dock__item.is-on {
    color: #111;
  }

  .mob-dock__item.is-on.is-center {
    color: #fff;
  }

  .mob-dock__item.is-on:not(.is-center) {
    color: #111;
  }

  .mob-dock__item.is-locked {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .mob-dock__item.is-locked.is-on {
    opacity: 0.9;
  }

  .mob-dock__item.is-on.is-center .mob-dock__label {
    color: #111;
  }

  .mob-dock__label {
    position: relative;
    z-index: 1;
    transition: color 0.2s ease;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0;
    line-height: 12px;
    text-align: center;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

@media (max-width: 900px) and (prefers-reduced-motion: reduce) {
  .mob-dock__orb,
  .mob-dock__icon,
  .mob-dock__item,
  .mob-dock__label {
    transition: none !important;
  }

  .mob-dock__item.is-on .mob-dock__icon,
  .mob-dock__item.is-on.is-center .mob-dock__icon,
  .mob-dock__item:active .mob-dock__icon {
    transform: none;
  }
}
</style>
