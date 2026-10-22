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
const orbX = ref(0);
const orbSize = ref(44);
const orbLift = ref(0);

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

const isActive = (to: string) => isDockItemActive(to, route.path);

const isLocked = (to: string) => !isNavPathUnlocked(to);

/** null — текущего раздела нет в доке: ничего не подсвечиваем (раньше падало на первый пункт). */
const activeTab = computed(() => findActiveDockItem(tabs.value, route.path));

const orbStyle = computed(() => ({
  transform: `translate3d(calc(${orbX.value}px - 50%), ${orbLift.value}px, 0)`,
  width: `${orbSize.value}px`,
  height: `${orbSize.value}px`
}));

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

  const barRect = bar.getBoundingClientRect();
  const itemRect = el.getBoundingClientRect();
  const icon = el.querySelector('.mob-dock__icon') as HTMLElement | null;
  const target = icon?.getBoundingClientRect() ?? itemRect;

  const size = tab.center ? 52 : 40;
  const orbCssTop = 4;
  const targetCenterY = target.top + target.height / 2 - barRect.top;

  orbX.value = target.left + target.width / 2 - barRect.left;
  orbSize.value = size;
  // Центр кружка = центр иконки (не «висит» над подписью)
  orbLift.value = targetCenterY - orbCssTop - size / 2;
  orbReady.value = true;
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
});

watch(
  () => [route.path, props.mode] as const,
  async () => {
    await nextTick();
    if (typeof document !== 'undefined') {
      const ae = document.activeElement;
      if (ae instanceof HTMLElement && ae.closest('.mob-dock')) {
        ae.blur();
      }
    }
    requestAnimationFrame(updateOrb);
  }
);
</script>

<template>
  <nav class="mob-dock" aria-label="Основное меню">
    <div ref="barRef" class="mob-dock__bar">
      <div
        class="mob-dock__orb"
        :class="{ 'is-ready': orbReady && !!activeTab, 'is-center': !!activeTab?.center, 'is-locked-target': activeTab && isLocked(activeTab.to) }"
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
    padding: 0 8px max(6px, env(safe-area-inset-bottom));
    pointer-events: none;
  }

  .mob-dock__bar {
    pointer-events: auto;
    position: relative;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: end;
    gap: 0;
    min-height: 60px;
    padding: 5px 4px 7px;
    border: 2px solid #111;
    border-radius: 24px;
    /* Серый внутри пилюли; снаружи .mob-dock без фона */
    background-color: #d8d8d4;
    background-image: none;
    box-shadow: 3px 3px 0 #111;
    overflow: visible;
  }

  .mob-dock__orb {
    position: absolute;
    top: 4px;
    left: 0;
    z-index: 0;
    border-radius: 999px;
    border: 2px solid #111;
    background: #7451f4;
    box-shadow: 2px 2px 0 #111;
    opacity: 0;
    pointer-events: none;
    will-change: transform, width, height;
    transition:
      transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
      width 0.28s cubic-bezier(0.22, 1, 0.36, 1),
      height 0.28s cubic-bezier(0.22, 1, 0.36, 1),
      background 0.2s ease,
      opacity 0.15s ease;
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
    justify-content: flex-end;
    gap: 2px;
    min-height: 44px;
    min-width: 0;
    padding: 2px 1px 0;
    border-radius: 14px;
    color: #555;
    text-decoration: none;
    font-weight: 700;
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

  .mob-dock__item.is-center {
    margin-top: -8px;
  }

  .mob-dock__icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    color: inherit;
  }

  .mob-dock__icon :deep(.mob-nav-ico) {
    width: 26px;
    height: 26px;
  }

  .mob-dock__item.is-center .mob-dock__icon {
    width: 48px;
    height: 48px;
  }

  .mob-dock__item.is-center .mob-dock__icon :deep(.mob-nav-ico) {
    width: 30px;
    height: 30px;
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

  .mob-dock__label {
    font-size: 0.52rem;
    letter-spacing: 0.01em;
    line-height: 1.1;
    text-align: center;
    max-width: 100%;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
}
</style>
