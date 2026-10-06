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
const route = useRoute();

const employeeTabs: Tab[] = [
  { to: '/knowledge', label: 'Знания', icon: 'knowledge' },
  { to: '/vacations', label: 'Отпуск', icon: 'vacation' },
  { to: '/', label: 'Главная', icon: 'home', center: true },
  { to: '/ideas', label: 'Идеи', icon: 'ideas' },
  { to: '/store', label: 'Магазин', icon: 'store' }
];

const adminTabs: Tab[] = [
  { to: '/admin/knowledge', label: 'Знания', icon: 'knowledge' },
  { to: '/admin/vacations', label: 'Отпуск', icon: 'vacation' },
  { to: '/admin/quest-dashboard', label: 'Pit Stop', icon: 'home', center: true },
  { to: '/admin/ideas', label: 'Идеи', icon: 'ideas' },
  { to: '/admin/employees', label: 'Люди', icon: 'store' }
];

const tabs = computed(() => (props.mode === 'admin' ? adminTabs : employeeTabs));

const lockedHint = 'Раздел скоро откроется';

const isActive = (to: string) => {
  if (to === '/') return route.path === '/';
  if (to === '/store') {
    return (
      route.path === '/store' ||
      route.path.startsWith('/store/') ||
      route.path === '/wallet' ||
      route.path.startsWith('/wallet/')
    );
  }
  if (to === '/admin/quest-dashboard') {
    return (
      route.path.startsWith('/admin/quest-dashboard') || route.path.startsWith('/event/pit-stop')
    );
  }
  return route.path === to || route.path.startsWith(`${to}/`);
};

const isLocked = (to: string) => !isNavPathUnlocked(to);
</script>

<template>
  <nav class="mob-dock" aria-label="Основное меню">
    <div class="mob-dock__bar">
      <template v-for="tab in tabs" :key="tab.to">
        <NuxtLink
          v-if="!isLocked(tab.to) && !tab.center"
          :to="tab.to"
          class="mob-dock__item"
          :class="{ 'is-on': isActive(tab.to) }"
        >
          <AppMobileNavIcon :name="tab.icon" />
          <span class="mob-dock__label">{{ tab.label }}</span>
        </NuxtLink>

        <span
          v-else-if="isLocked(tab.to) && !tab.center"
          class="mob-dock__item is-locked"
          role="link"
          aria-disabled="true"
          :title="lockedHint"
        >
          <AppMobileNavIcon :name="tab.icon" locked />
          <span class="mob-dock__label">{{ tab.label }}</span>
        </span>

        <div v-else class="mob-dock__center-slot">
          <NuxtLink
            v-if="!isLocked(tab.to)"
            :to="tab.to"
            class="mob-dock__fab"
            :class="{ 'is-on': isActive(tab.to) }"
            :aria-label="tab.label"
          >
            <AppMobileNavIcon :name="tab.icon" />
          </NuxtLink>
          <span
            v-else
            class="mob-dock__fab is-locked"
            role="link"
            aria-disabled="true"
            :aria-label="`${tab.label} — скоро`"
            :title="lockedHint"
          >
            <AppMobileNavIcon :name="tab.icon" locked />
          </span>
          <span class="mob-dock__fab-label">{{ tab.label }}</span>
        </div>
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
    z-index: 40;
    padding: 0 12px max(10px, env(safe-area-inset-bottom));
    pointer-events: none;
  }

  .mob-dock__bar {
    pointer-events: auto;
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr 72px 1fr 1fr;
    align-items: end;
    gap: 2px;
    min-height: 64px;
    padding: 8px 6px 10px;
    border: 2px solid #111;
    border-radius: 28px;
    background-color: #eeeee8;
    background-image: var(--noise-url);
    background-size: 180px 180px;
    box-shadow: 4px 4px 0 #111;
  }

  .mob-dock__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: 48px;
    padding: 4px 2px;
    border-radius: 16px;
    color: #555;
    text-decoration: none;
    font-weight: 700;
    transition: background 0.12s ease, color 0.12s ease, transform 0.12s ease;
  }

  .mob-dock__item.is-on {
    color: #111;
    background: #ddf365;
  }

  .mob-dock__item.is-locked {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .mob-dock__label {
    font-size: 0.62rem;
    letter-spacing: 0.02em;
    line-height: 1.1;
    text-align: center;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mob-dock__center-slot {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    min-height: 48px;
    margin-top: -28px;
  }

  .mob-dock__fab {
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    border-radius: 999px;
    border: 2px solid #111;
    background: #7451f4;
    color: #fff;
    box-shadow: 3px 3px 0 #111;
    text-decoration: none;
  }

  .mob-dock__fab.is-on {
    background: #ddf365;
    color: #111;
  }

  .mob-dock__fab.is-locked {
    opacity: 0.85;
    cursor: not-allowed;
    background: #9b86f0;
  }

  .mob-dock__fab-label {
    margin-top: 2px;
    font-size: 0.62rem;
    font-weight: 800;
    color: #111;
  }
}
</style>
