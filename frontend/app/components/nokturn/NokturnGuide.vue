<template>
  <Transition name="nk-guide">
    <aside v-if="shown" class="nk-guide" role="dialog" :aria-label="investigator.name">
      <img
        class="nk-guide__photo"
        :src="investigator.photo"
        :alt="investigator.name"
        draggable="false"
      />
      <div class="nk-guide__bubble">
        <header class="nk-guide__head">
          <p class="nk-guide__name">{{ investigator.name }}</p>
          <button
            type="button"
            class="nk-icon-btn nk-icon-btn--onDark"
            aria-label="Закрыть"
            title="Закрыть"
            @click="dismiss"
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </header>

        <p class="nk-guide__text">{{ current }}</p>

        <footer class="nk-guide__foot">
          <span class="nk-guide__dots" aria-hidden="true">
            <i v-for="(_, i) in lines" :key="i" :class="{ 'is-on': i === step }" />
          </span>
          <button type="button" class="nk-btn nk-btn--primary nk-btn--sm" @click="next">
            {{ isLast ? 'За работу' : 'Дальше' }}
          </button>
        </footer>
      </div>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
/**
 * Соловьёва ведёт игрока по дню: всплывает, говорит порциями и уходит
 * до следующего этапа. Срок задержания она называет сама — отдельного
 * счётчика в шапке нет.
 */
const props = defineProps<{
  stageId: number | null;
  /** Абзацы брифа дня. */
  briefing: string[];
  deadlineLine: string;
  investigator: { name: string; title: string; photo: string };
  /** Показать принудительно (кнопка «Бриф следователя»). */
  force: number;
}>();

const emit = defineEmits<{ closed: [] }>();

const SEEN_KEY = 'vbi-nokturn-guide-seen';

const shown = ref(false);
const step = ref(0);

const lines = computed(() =>
  props.briefing.length ? [...props.briefing, props.deadlineLine].filter(Boolean) : []
);
const current = computed(() => lines.value[step.value] ?? '');
const isLast = computed(() => step.value >= lines.value.length - 1);

function seenStages(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function markSeen(id: number) {
  try {
    const all = new Set(seenStages());
    all.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...all]));
  } catch {
    /* приватный режим — бриф просто покажется снова */
  }
}

function open() {
  if (!lines.value.length) return;
  step.value = 0;
  shown.value = true;
}

function next() {
  if (!isLast.value) {
    step.value += 1;
    return;
  }
  dismiss();
}

function dismiss() {
  shown.value = false;
  if (props.stageId) markSeen(props.stageId);
  emit('closed');
}

function onKey(e: KeyboardEvent) {
  if (shown.value && e.key === 'Escape') dismiss();
}

// Новый этап — Соловьёва приходит сама, один раз за день.
watch(
  () => [props.stageId, props.briefing.length] as const,
  () => {
    const id = props.stageId;
    if (!id || !props.briefing.length) return;
    if (seenStages().includes(id)) return;
    open();
  },
  { immediate: true }
);

// Кнопка «Бриф следователя» — показать ещё раз по требованию.
watch(
  () => props.force,
  (v, prev) => {
    if (v !== prev) open();
  }
);

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>
