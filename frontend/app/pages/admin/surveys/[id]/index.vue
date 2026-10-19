<template>
  <div class="survey-builder">
    <div v-if="!loaded" class="card section-card muted">Загрузка…</div>

    <template v-else-if="survey">
      <section class="card section-card survey-builder__hero">
        <div class="section-head survey-builder__head">
          <div class="survey-builder__title-row">
            <NuxtLink to="/admin/surveys" class="button ghost">← Все опросы</NuxtLink>
            <span class="pill" :class="`survey-builder__status--${survey.status}`">
              {{ statusLabel(survey.status) }}
            </span>
          </div>
          <div class="survey-builder__actions">
            <NuxtLink class="button ghost" :to="`/admin/surveys/${survey.id}/results`">
              Результаты
            </NuxtLink>
            <a class="button ghost" :href="`/admin/surveys/${survey.id}/preview`" target="_blank" rel="noopener">
              Просмотр
            </a>
            <button
              v-if="survey.status !== 'published'"
              class="button primary"
              type="button"
              @click="onPublish"
            >
              Опубликовать
            </button>
            <button v-else class="button ghost" type="button" @click="onUnpublish">
              Остановить
            </button>
          </div>
        </div>

        <label class="survey-builder__field">
          <span class="survey-builder__field-label">Название опроса</span>
          <input v-model="title" type="text" class="survey-builder__input" />
        </label>

        <label class="survey-builder__field">
          <span class="survey-builder__field-label">Описание (необязательно)</span>
          <textarea v-model="description" class="survey-builder__textarea" rows="2" />
        </label>

        <label class="survey-builder__anon">
          <input v-model="anonymous" type="checkbox" />
          <span>Анонимный опрос — не сохранять, кто ответил</span>
        </label>

        <div v-if="survey.status === 'published'" class="survey-builder__link">
          <span class="survey-builder__field-label">Ссылка для респондентов</span>
          <div class="survey-builder__link-row">
            <code ref="linkEl">{{ publicUrl(survey.slug) }}</code>
            <button class="button ghost" type="button" @click="copyLink">Скопировать</button>
          </div>
          <p
            v-if="copyState !== 'idle'"
            class="survey-builder__copy-status"
            :class="`survey-builder__copy-status--${copyState}`"
            role="status"
          >
            {{ copyState === 'ok' ? 'Ссылка скопирована' : 'Не удалось скопировать автоматически — ссылка выделена, нажмите Ctrl+C (⌘C)' }}
          </p>
        </div>
      </section>

      <section class="card section-card survey-builder__questions">
        <h3 class="section-title">Вопросы</h3>

        <div v-if="!questions.length" class="muted survey-builder__empty">
          Добавьте первый вопрос ниже.
        </div>

        <template v-for="(q, idx) in questions" :key="q.id">
        <div class="survey-q">
          <div class="survey-q__head">
            <span class="survey-q__index">{{ idx + 1 }}</span>
            <select v-model="q.type" class="survey-q__type-select" @change="onTypeChange(q)">
              <option v-for="t in SURVEY_QUESTION_TYPES" :key="t" :value="t">
                {{ SURVEY_QUESTION_TYPE_LABELS[t] }}
              </option>
            </select>
            <div class="survey-q__reorder">
              <button
                type="button"
                class="button ghost survey-q__icon-btn"
                :disabled="idx === 0"
                aria-label="Поднять вопрос"
                title="Поднять вопрос"
                @click="moveUp(idx)"
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                  <path d="M10 15V5M5.5 9.5 10 5l4.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                class="button ghost survey-q__icon-btn"
                :disabled="idx === questions.length - 1"
                aria-label="Опустить вопрос"
                title="Опустить вопрос"
                @click="moveDown(idx)"
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                  <path d="M10 5v10M5.5 10.5 10 15l4.5-4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="button ghost survey-q__icon-btn"
              aria-label="Дублировать вопрос"
              title="Дублировать вопрос"
              @click="duplicateQuestion(idx)"
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                <rect x="3.5" y="5.5" width="10" height="11" rx="2" stroke="currentColor" stroke-width="1.5" />
                <path d="M7 5.5V4.5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1" stroke="currentColor" stroke-width="1.5" />
              </svg>
            </button>
            <button
              type="button"
              class="button ghost survey-q__icon-btn survey-q__remove"
              aria-label="Удалить вопрос"
              title="Удалить вопрос"
              @click="removeQuestion(idx)"
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                <path d="M4.5 6h11M8.25 6V4.75a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1V6M6 6l.6 9.2a1.5 1.5 0 0 0 1.5 1.4h3.8a1.5 1.5 0 0 0 1.5-1.4L14 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <input
            v-model="q.text"
            type="text"
            class="survey-builder__input survey-q__text"
            :placeholder="q.type === 'info' ? 'Текст блока' : 'Текст вопроса'"
          />

          <!-- single/multi: редактируемые варианты + визуальный radio/checkbox -->
          <div v-if="q.type === 'single' || q.type === 'multi'" class="survey-q__options">
            <div v-for="(opt, oIdx) in q.options" :key="oIdx" class="survey-q__option-row">
              <span
                class="survey-q__option-icon"
                :class="q.type === 'single' ? 'is-radio' : 'is-checkbox'"
                aria-hidden="true"
              />
              <input
                v-model="q.options![oIdx]"
                type="text"
                class="survey-builder__input"
                :placeholder="`Вариант ${oIdx + 1}`"
              />
              <button
                type="button"
                class="button ghost survey-q__option-remove"
                :disabled="(q.options?.length ?? 0) <= 2"
                aria-label="Удалить вариант"
                title="Удалить вариант"
                @click="removeOption(q, oIdx)"
              >
                <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
                  <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="button ghost survey-q__option-add"
              aria-label="Добавить вариант"
              title="Добавить вариант"
              @click="addOption(q)"
            >
              <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
                <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
              <span>Вариант</span>
            </button>
          </div>

          <!-- yes/no: превью как на публичной странице, вариантов фиксировано -->
          <div v-else-if="q.type === 'yesno'" class="survey-q__pills">
            <span class="survey-q__pill">Да</span>
            <span class="survey-q__pill">Нет</span>
          </div>

          <!-- smiley: живое превью смайлов + редактируемые подписи + число точек -->
          <div v-else-if="q.type === 'smiley'" class="survey-q__smiley">
            <div class="survey-q__smiley-count">
              <span class="survey-q__field-label-inline">Точек:</span>
              <button
                v-for="c in SMILEY_POINT_COUNTS"
                :key="c"
                type="button"
                class="button ghost survey-q__count-btn"
                :class="{ 'is-active': (q.smileyLabels?.length ?? 5) === c }"
                @click="setSmileyCount(q, c)"
              >
                {{ c }}
              </button>
            </div>
            <div class="survey-q__smiley-row">
              <div v-for="(label, sIdx) in q.smileyLabels" :key="sIdx" class="survey-q__smiley-item">
                <span class="survey-q__smiley-face">{{ smileyEmojiAt(sIdx, q.smileyLabels!.length) }}</span>
                <input
                  v-model="q.smileyLabels![sIdx]"
                  type="text"
                  class="survey-builder__input survey-q__smiley-label-input"
                  placeholder="Подпись"
                />
              </div>
            </div>
          </div>

          <!-- nps: превью шкалы 0..10 + редактируемые подписи краёв -->
          <div v-else-if="q.type === 'nps'" class="survey-q__scale-preview">
            <div class="survey-q__scale-row">
              <span v-for="n in 11" :key="n - 1" class="survey-q__scale-chip">{{ n - 1 }}</span>
            </div>
            <div class="survey-q__nps-labels">
              <input v-model="q.npsLowLabel" type="text" class="survey-builder__input" placeholder="Подпись для 0" />
              <input v-model="q.npsHighLabel" type="text" class="survey-builder__input" placeholder="Подпись для 10" />
            </div>
          </div>

          <!-- scale: настройка границ + превью ряда значений -->
          <div v-else-if="q.type === 'scale'" class="survey-q__scale-preview">
            <div class="survey-q__scale-config">
              <label>
                От
                <input v-model.number="q.scaleMin" type="number" class="survey-builder__input survey-q__scale-input" />
              </label>
              <label>
                До
                <input v-model.number="q.scaleMax" type="number" class="survey-builder__input survey-q__scale-input" />
              </label>
            </div>
            <div v-if="scaleNumbers(q).length <= 25" class="survey-q__scale-row">
              <span v-for="n in scaleNumbers(q)" :key="n" class="survey-q__scale-chip">{{ n }}</span>
            </div>
          </div>

          <!-- короткий текст: превью однострочного поля -->
          <input
            v-else-if="q.type === 'text_short'"
            type="text"
            class="survey-builder__input survey-q__preview-disabled"
            placeholder="Короткий текстовый ответ"
            disabled
          />

          <!-- длинный текст: превью textarea -->
          <textarea
            v-else-if="q.type === 'text_long'"
            class="survey-builder__textarea survey-q__preview-disabled"
            rows="3"
            placeholder="Длинный текстовый ответ"
            disabled
          />

          <label v-if="q.type !== 'info'" class="survey-q__required">
            <input v-model="q.required" type="checkbox" /> Обязательный вопрос
          </label>
        </div>

        <div class="survey-builder__add-trigger-row">
          <SurveysTypePicker @select="(t) => insertQuestionAfter(idx, t)" />
        </div>
        </template>

        <div v-if="!questions.length" class="survey-builder__add-trigger-row">
          <SurveysTypePicker @select="(t) => insertQuestionAfter(-1, t)" />
        </div>
      </section>

      <div class="survey-builder__save-bar">
        <span v-if="saveState === 'saved'" class="muted">Сохранено</span>
        <span v-else-if="saveState === 'error'" class="survey-builder__save-error">Не удалось сохранить</span>
        <button class="button primary" type="button" :disabled="saveState === 'saving'" @click="onSave">
          {{ saveState === 'saving' ? 'Сохраняем…' : 'Сохранить' }}
        </button>
      </div>
    </template>

    <div v-else class="card section-card muted">Опрос не найден.</div>
  </div>
</template>

<script setup lang="ts">
import {
  SURVEY_QUESTION_TYPES,
  SURVEY_QUESTION_TYPE_LABELS,
  SMILEY_LABELS,
  SMILEY_POINT_COUNTS,
  NPS_DEFAULT_LOW_LABEL,
  NPS_DEFAULT_HIGH_LABEL,
  smileyEmojiAt,
  resizeSmileyLabels,
  statusLabel,
  defaultQuestionForType,
  type Survey,
  type SurveyQuestion,
  type SurveyQuestionType
} from '~/composables/useSurveys';

const route = useRoute();
const id = String(route.params.id || '');

const { fetchOne, updateSurvey, publishSurvey, unpublishSurvey, publicUrl } = useAdminSurveys();

const survey = ref<Survey | null>(null);
const loaded = ref(false);
const title = ref('');
const description = ref('');
const anonymous = ref(false);
const questions = ref<SurveyQuestion[]>([]);
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');

const applySurvey = (s: Survey) => {
  survey.value = s;
  title.value = s.title;
  description.value = s.description || '';
  anonymous.value = s.anonymous;
  questions.value = s.questions.map((q) => ({
    ...q,
    options: q.options ? [...q.options] : undefined,
    // Бэкфилл для опросов, созданных до появления этих полей.
    smileyLabels: q.type === 'smiley' ? (q.smileyLabels?.length ? [...q.smileyLabels] : [...SMILEY_LABELS]) : undefined,
    npsLowLabel: q.type === 'nps' ? q.npsLowLabel || NPS_DEFAULT_LOW_LABEL : undefined,
    npsHighLabel: q.type === 'nps' ? q.npsHighLabel || NPS_DEFAULT_HIGH_LABEL : undefined
  }));
};

const result = await fetchOne(id);
if (result) applySurvey(result);
loaded.value = true;

const genId = () => {
  if (import.meta.client && 'randomUUID' in crypto) return `q-${crypto.randomUUID()}`;
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

// idx = -1 вставляет в начало списка (пустой опрос или «+» над первым вопросом).
const insertQuestionAfter = (idx: number, type: SurveyQuestionType) => {
  questions.value.splice(idx + 1, 0, { id: genId(), ...defaultQuestionForType(type) });
};

const duplicateQuestion = (idx: number) => {
  const q = questions.value[idx];
  if (!q) return;
  const clone: SurveyQuestion = {
    ...q,
    id: genId(),
    options: q.options ? [...q.options] : undefined,
    smileyLabels: q.smileyLabels ? [...q.smileyLabels] : undefined
  };
  questions.value.splice(idx + 1, 0, clone);
};

const removeQuestion = (idx: number) => {
  questions.value.splice(idx, 1);
};

const moveUp = (idx: number) => {
  if (idx === 0) return;
  const arr = questions.value;
  [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
};

const moveDown = (idx: number) => {
  const arr = questions.value;
  if (idx >= arr.length - 1) return;
  [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
};

const addOption = (q: SurveyQuestion) => {
  if (!q.options) q.options = [];
  q.options.push(`Вариант ${q.options.length + 1}`);
};

const removeOption = (q: SurveyQuestion, oIdx: number) => {
  if (!q.options || q.options.length <= 2) return;
  q.options.splice(oIdx, 1);
};

// При смене типа существующего вопроса — заполняем недостающие поля под новый тип
// (текст/required сохраняем, остальное из defaultQuestionForType, где не задано).
const onTypeChange = (q: SurveyQuestion) => {
  const defaults = defaultQuestionForType(q.type);
  if ((q.type === 'single' || q.type === 'multi') && !q.options?.length) {
    q.options = [...(defaults.options || ['Вариант 1', 'Вариант 2'])];
  }
  if (q.type === 'scale' && (q.scaleMin === undefined || q.scaleMax === undefined)) {
    q.scaleMin = defaults.scaleMin ?? 1;
    q.scaleMax = defaults.scaleMax ?? 10;
  }
  if (q.type === 'smiley' && !q.smileyLabels?.length) {
    q.smileyLabels = [...SMILEY_LABELS];
  }
  if (q.type === 'nps') {
    if (!q.npsLowLabel) q.npsLowLabel = NPS_DEFAULT_LOW_LABEL;
    if (!q.npsHighLabel) q.npsHighLabel = NPS_DEFAULT_HIGH_LABEL;
  }
};

const setSmileyCount = (q: SurveyQuestion, count: number) => {
  q.smileyLabels = resizeSmileyLabels(q.smileyLabels || [...SMILEY_LABELS], count);
};

const scaleNumbers = (q: SurveyQuestion): number[] => {
  const min = q.scaleMin ?? 1;
  const max = q.scaleMax ?? 10;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
  const out: number[] = [];
  for (let i = min; i <= max; i += 1) out.push(i);
  return out;
};

const onSave = async () => {
  saveState.value = 'saving';
  const updated = await updateSurvey(id, {
    title: title.value,
    description: description.value,
    anonymous: anonymous.value,
    questions: questions.value
  });
  if (updated) {
    applySurvey(updated);
    saveState.value = 'saved';
  } else {
    saveState.value = 'error';
  }
};

const onPublish = async () => {
  await onSave();
  const res = await publishSurvey(id);
  if (!res.ok) {
    window.alert(res.error || 'Не удалось опубликовать');
    return;
  }
  const refreshed = await fetchOne(id);
  if (refreshed) applySurvey(refreshed);
};

const onUnpublish = async () => {
  await unpublishSurvey(id);
  const refreshed = await fetchOne(id);
  if (refreshed) applySurvey(refreshed);
};

const linkEl = ref<HTMLElement | null>(null);
const copyState = ref<'idle' | 'ok' | 'fail'>('idle');
let copyStateTimer: ReturnType<typeof setTimeout> | undefined;

const copyLink = async () => {
  if (!survey.value) return;
  const ok = await copyToClipboard(publicUrl(survey.value.slug));
  if (!ok) selectElementText(linkEl.value);
  copyState.value = ok ? 'ok' : 'fail';
  if (copyStateTimer) clearTimeout(copyStateTimer);
  copyStateTimer = setTimeout(() => {
    copyState.value = 'idle';
  }, ok ? 2000 : 6000);
};

onBeforeUnmount(() => {
  if (copyStateTimer) clearTimeout(copyStateTimer);
});
</script>

<style scoped>
/*
 * Опросы (админка) — осознанное исключение из общего necroбрутализма платформы,
 * ближе к референсу webask.io. См. комментарий в admin/surveys/index.vue и CHANGELOG.
 */
.survey-builder {
  --sv-accent: #4f6ef7;
  --sv-accent-hover: #3b5ce0;
  --sv-accent-soft: rgba(79, 110, 247, 0.12);
  --sv-border: #e5e5e8;
  --sv-muted: #6b7280;
  --sv-radius: 14px;
  display: grid;
  gap: 12px;
}

.survey-builder .card {
  border: 1px solid var(--sv-border);
  border-radius: var(--sv-radius);
  box-shadow: none;
  background: #fff;
}

.survey-builder .card.section-card {
  padding: 16px 20px;
}

.survey-builder .card::before {
  display: none;
}

.survey-builder .section-title {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.survey-builder .muted {
  font-size: 0.92rem;
  color: var(--sv-muted);
}

.survey-builder .button {
  border-radius: 10px;
  text-transform: none;
  letter-spacing: normal;
  font-size: 0.92rem;
  font-weight: 600;
  padding: 9px 20px;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.survey-builder .button.primary {
  background: var(--sv-accent);
  border-color: var(--sv-accent);
}

.survey-builder .button.primary:hover {
  background: var(--sv-accent-hover);
  border-color: var(--sv-accent-hover);
  transform: none;
}

.survey-builder .button.ghost {
  border: 1px solid var(--sv-border);
  color: var(--text);
}

.survey-builder .button.ghost:hover {
  background: #f7f7f8;
  border-color: var(--sv-border);
  color: var(--text);
  transform: none;
}

.survey-builder .pill {
  border: none;
  font-weight: 600;
  font-size: 0.76rem;
  text-transform: none;
  background: #eceef2;
  color: var(--sv-muted);
}

.survey-builder__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.survey-builder__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.survey-builder__actions {
  display: flex;
  gap: 8px;
}

.survey-builder__field {
  display: grid;
  gap: 4px;
  margin-top: 10px;
}

.survey-builder__field-label {
  font-size: 0.86rem;
  font-weight: 500;
  color: var(--sv-muted);
}

.survey-builder__input,
.survey-builder__textarea {
  border: 1px solid var(--sv-border);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 0.95rem;
  font-family: var(--font-body);
  background: var(--bg-surface);
  color: var(--text);
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}

.survey-builder__textarea {
  min-height: 0;
  line-height: 1.4;
  resize: vertical;
}

.survey-builder__input:focus,
.survey-builder__textarea:focus {
  outline: none;
  border-color: var(--sv-accent);
}

.survey-builder__anon {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 0.88rem;
  font-weight: 600;
}

.survey-builder__link {
  margin-top: 10px;
}

.survey-builder__link-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.survey-builder__link-row code {
  background: var(--bg-elevated);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.82rem;
  user-select: all;
  word-break: break-all;
}

.survey-builder__copy-status {
  margin: 6px 0 0;
  font-size: 0.82rem;
  font-weight: 600;
}

.survey-builder__copy-status--ok {
  color: var(--sv-accent);
}

.survey-builder__copy-status--fail {
  color: #b42318;
}

.survey-builder__status--draft {
  background: #eceef2;
}

.survey-builder__status--published {
  background: var(--sv-accent-soft);
  color: var(--sv-accent);
}

.survey-builder__status--closed {
  background: #eceef2;
  opacity: 0.7;
}

.survey-q {
  border: 1px solid var(--sv-border);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
  display: grid;
  gap: 8px;
}

.survey-q__head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.survey-q__index {
  font-weight: 800;
  width: 22px;
}

.survey-q__type-select {
  border: 1px solid var(--sv-border);
  border-radius: 10px;
  padding: 7px 10px;
  font-size: 0.85rem;
  background: var(--bg-surface);
  color: var(--text);
}

.survey-q__reorder {
  display: flex;
  gap: 4px;
}

.survey-q__icon-btn {
  width: 34px;
  height: 34px;
  padding: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
}

.survey-q__remove {
  margin-left: auto;
  color: #c2402f;
}

.survey-q__remove:hover {
  background: #fdecea;
  border-color: #f1b4ac;
  color: #c2402f;
}

.survey-q__options {
  display: grid;
  gap: 6px;
}

.survey-q__option-remove {
  width: 30px;
  height: 30px;
  padding: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--sv-muted);
}

.survey-q__option-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 6px 12px !important;
  font-size: 0.82rem !important;
}

.survey-q__option-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.survey-q__option-row .survey-builder__input {
  flex: 1;
}

.survey-q__option-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--sv-muted);
  box-sizing: border-box;
}

.survey-q__option-icon.is-radio {
  border-radius: 50%;
}

.survey-q__option-icon.is-checkbox {
  border-radius: 4px;
}

.survey-q__pills {
  display: flex;
  gap: 10px;
}

.survey-q__pill {
  border: 1px solid var(--sv-border);
  border-radius: 999px;
  padding: 7px 18px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--sv-muted);
  background: #f7f7f8;
}

.survey-q__field-label-inline {
  font-size: 0.82rem;
  color: var(--sv-muted);
  margin-right: 4px;
}

.survey-q__smiley {
  display: grid;
  gap: 10px;
}

.survey-q__smiley-count {
  display: flex;
  align-items: center;
  gap: 6px;
}

.survey-q__count-btn {
  padding: 5px 12px !important;
  font-size: 0.82rem !important;
}

.survey-q__count-btn.is-active {
  background: var(--sv-accent-soft);
  border-color: var(--sv-accent);
  color: var(--sv-accent);
}

.survey-q__smiley-row {
  display: flex;
  gap: 8px;
}

.survey-q__smiley-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.survey-q__smiley-face {
  font-size: 26px;
  line-height: 1;
}

.survey-q__smiley-label-input {
  width: 100%;
  padding: 6px 8px !important;
  font-size: 0.78rem !important;
  text-align: center;
}

.survey-q__scale-preview {
  display: grid;
  gap: 10px;
}

.survey-q__scale-config {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
}

.survey-q__scale-input {
  width: 70px;
  margin-left: 6px;
}

.survey-q__scale-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.survey-q__scale-chip {
  min-width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--sv-border);
  border-radius: 8px;
  font-size: 0.82rem;
  color: var(--sv-muted);
  background: #f7f7f8;
}

.survey-q__nps-labels {
  display: flex;
  gap: 10px;
}

.survey-q__nps-labels .survey-builder__input {
  flex: 1;
}

.survey-q__preview-disabled {
  background: #f7f7f8;
  color: var(--sv-muted);
  cursor: default;
}

.survey-q__required {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}

.survey-builder__empty {
  margin-bottom: 12px;
}

.survey-builder__add-trigger-row {
  display: flex;
  justify-content: center;
  padding: 0 0 8px;
}

.survey-builder__save-bar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.survey-builder__save-error {
  color: #c2402f;
  font-weight: 700;
}
</style>
