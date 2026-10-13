<template>
  <div class="sv-actions-menu" @keydown.escape="close">
    <button
      type="button"
      class="sv-actions-menu__trigger"
      :class="{ 'is-open': open }"
      :aria-expanded="open"
      aria-haspopup="true"
      :aria-label="triggerLabel"
      @click.stop="toggle"
    >
      <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
        <circle cx="10" cy="4" r="1.6" />
        <circle cx="10" cy="10" r="1.6" />
        <circle cx="10" cy="16" r="1.6" />
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuEl"
        class="sv-actions-menu__panel"
        :style="panelStyle"
        role="menu"
        @click.stop
      >
        <template v-for="(item, idx) in items" :key="item.key">
          <div v-if="item.dividerBefore && idx > 0" class="sv-actions-menu__divider" />
          <button
            type="button"
            class="sv-actions-menu__item"
            :class="{ 'is-danger': item.danger }"
            role="menuitem"
            @click="select(item)"
          >
            {{ item.label }}
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
export interface SurveyActionsMenuItem {
  key: string;
  label: string;
  danger?: boolean;
  /** Отделить от предыдущего пункта тонкой линией (начало новой группы). */
  dividerBefore?: boolean;
}

const props = defineProps<{
  items: SurveyActionsMenuItem[];
  triggerLabel?: string;
}>();

const emit = defineEmits<{ select: [key: string] }>();

const open = ref(false);
const menuEl = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});
const triggerLabel = props.triggerLabel || 'Действия';

const close = () => {
  open.value = false;
};

const toggle = (evt: MouseEvent) => {
  if (open.value) {
    close();
    return;
  }
  const btn = evt.currentTarget as HTMLElement;
  const rect = btn.getBoundingClientRect();
  const panelWidth = 220;
  let left = rect.right - panelWidth;
  if (left < 8) left = 8;
  panelStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${left}px`,
    width: `${panelWidth}px`
  };
  open.value = true;
};

const select = (item: SurveyActionsMenuItem) => {
  close();
  emit('select', item.key);
};

const onDocClick = () => {
  if (open.value) close();
};

onMounted(() => {
  window.addEventListener('click', onDocClick);
  window.addEventListener('scroll', close, true);
});

onUnmounted(() => {
  window.removeEventListener('click', onDocClick);
  window.removeEventListener('scroll', close, true);
});
</script>

<style scoped>
.sv-actions-menu {
  position: relative;
  display: inline-flex;
}

.sv-actions-menu__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--sv-border, #e5e5e8);
  border-radius: 10px;
  background: #fff;
  color: var(--sv-muted, #6b7280);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.sv-actions-menu__trigger:hover,
.sv-actions-menu__trigger.is-open {
  background: #f7f7f8;
  border-color: var(--sv-accent, #4f6ef7);
  color: var(--sv-accent, #4f6ef7);
}

.sv-actions-menu__panel {
  z-index: 1000;
  background: #fff;
  border: 1px solid var(--sv-border, #e5e5e8);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(20, 20, 30, 0.12);
  padding: 6px;
  display: grid;
  gap: 2px;
}

.sv-actions-menu__item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 9px 12px;
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text, #1a1a1a);
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--font-body, inherit);
}

.sv-actions-menu__item:hover {
  background: #f1f3f9;
}

.sv-actions-menu__item.is-danger {
  color: #c2402f;
}

.sv-actions-menu__item.is-danger:hover {
  background: #fdecea;
}

.sv-actions-menu__divider {
  height: 1px;
  background: var(--sv-border, #e5e5e8);
  margin: 4px 2px;
}
</style>
