<template>
  <div class="sv-type-picker" @keydown.escape="close">
    <button
      type="button"
      class="sv-type-picker__trigger"
      :class="{ 'is-open': open }"
      :aria-expanded="open"
      aria-haspopup="true"
      aria-label="Добавить вопрос"
      title="Добавить вопрос"
      @click.stop="toggle"
    >
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
        <path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuEl"
        class="sv-type-picker__panel"
        :style="panelStyle"
        role="menu"
        @click.stop
      >
        <button
          v-for="t in SURVEY_QUESTION_TYPES"
          :key="t"
          type="button"
          class="sv-type-picker__item"
          role="menuitem"
          @click="select(t)"
        >
          <SurveysQuestionTypeIcon :type="t" />
          <span>{{ SURVEY_QUESTION_TYPE_LABELS[t] }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  SURVEY_QUESTION_TYPES,
  SURVEY_QUESTION_TYPE_LABELS,
  type SurveyQuestionType
} from '~/composables/useSurveys';

const emit = defineEmits<{ select: [type: SurveyQuestionType] }>();

const open = ref(false);
const menuEl = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});

const close = () => {
  open.value = false;
};

const PANEL_WIDTH = 240;
const PANEL_MAX_HEIGHT = 320;
const GAP = 6;
const MARGIN = 8;

const toggle = (evt: MouseEvent) => {
  if (open.value) {
    close();
    return;
  }
  const btn = evt.currentTarget as HTMLElement;
  const rect = btn.getBoundingClientRect();

  let left = rect.left + rect.width / 2 - PANEL_WIDTH / 2;
  if (left < MARGIN) left = MARGIN;
  const viewportRight = window.innerWidth - MARGIN;
  if (left + PANEL_WIDTH > viewportRight) left = viewportRight - PANEL_WIDTH;

  // Коллизия с нижним краем вьюпорта: если снизу не хватает места под полный
  // список типов, но сверху его больше — открываем панель вверх от кнопки.
  // В любом случае высота панели клэмпится под доступное пространство,
  // внутренний скролл (overflow-y: auto в CSS) добирает остаток.
  const spaceBelow = window.innerHeight - rect.bottom - GAP - MARGIN;
  const spaceAbove = rect.top - GAP - MARGIN;

  let top: number;
  let maxHeight: number;
  if (spaceBelow >= PANEL_MAX_HEIGHT || spaceBelow >= spaceAbove) {
    maxHeight = Math.max(160, Math.min(PANEL_MAX_HEIGHT, spaceBelow));
    top = rect.bottom + GAP;
    const maxTop = window.innerHeight - MARGIN - maxHeight;
    if (top > maxTop) top = Math.max(MARGIN, maxTop);
  } else {
    maxHeight = Math.max(160, Math.min(PANEL_MAX_HEIGHT, spaceAbove));
    top = rect.top - GAP - maxHeight;
    if (top < MARGIN) top = MARGIN;
  }

  panelStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${PANEL_WIDTH}px`,
    maxHeight: `${maxHeight}px`
  };
  open.value = true;
};

const select = (type: SurveyQuestionType) => {
  close();
  emit('select', type);
};

const onDocClick = () => {
  if (open.value) close();
};

// Список типов длиннее, чем у ActionsMenu, и скроллится сам (overflow-y: auto) —
// поэтому скролл ВНУТРИ панели не должен её закрывать, только скролл страницы под ней.
const onWindowScroll = (evt: Event) => {
  if (!open.value) return;
  if (menuEl.value && evt.target instanceof Node && menuEl.value.contains(evt.target)) return;
  close();
};

onMounted(() => {
  window.addEventListener('click', onDocClick);
  window.addEventListener('scroll', onWindowScroll, true);
});

onUnmounted(() => {
  window.removeEventListener('click', onDocClick);
  window.removeEventListener('scroll', onWindowScroll, true);
});
</script>

<style scoped>
.sv-type-picker {
  display: inline-flex;
}

.sv-type-picker__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--sv-border, #e5e5e8);
  background: #fff;
  color: var(--sv-accent, #4f6ef7);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.sv-type-picker__trigger:hover,
.sv-type-picker__trigger.is-open {
  background: var(--sv-accent-soft, rgba(79, 110, 247, 0.12));
  border-color: var(--sv-accent, #4f6ef7);
}

.sv-type-picker__panel {
  z-index: 1000;
  background: #fff;
  border: 1px solid var(--sv-border, #e5e5e8);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(20, 20, 30, 0.12);
  padding: 6px;
  display: grid;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
}

.sv-type-picker__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 8px 10px;
  font-size: 0.86rem;
  font-weight: 500;
  color: var(--text, #1a1a1a);
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--font-body, inherit);
}

.sv-type-picker__item:hover {
  background: #f1f3f9;
}

.sv-type-picker__item svg {
  flex-shrink: 0;
  color: var(--sv-muted, #6b7280);
}
</style>
