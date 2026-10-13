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
            <code>{{ publicUrl(survey.slug) }}</code>
            <button class="button ghost" type="button" @click="copyLink">Скопировать</button>
          </div>
        </div>
      </section>

      <section class="card section-card survey-builder__questions">
        <h3 class="section-title">Вопросы</h3>

        <div v-if="!questions.length" class="muted survey-builder__empty">
          Добавьте первый вопрос ниже.
        </div>

        <div v-for="(q, idx) in questions" :key="q.id" class="survey-q">
          <div class="survey-q__head">
            <span class="survey-q__index">{{ idx + 1 }}</span>
            <select v-model="q.type" class="survey-q__type-select">
              <option v-for="t in SURVEY_QUESTION_TYPES" :key="t" :value="t">
                {{ SURVEY_QUESTION_TYPE_LABELS[t] }}
              </option>
            </select>
            <div class="survey-q__reorder">
              <button type="button" class="button ghost" :disabled="idx === 0" @click="moveUp(idx)">
                ↑
              </button>
              <button
                type="button"
                class="button ghost"
                :disabled="idx === questions.length - 1"
                @click="moveDown(idx)"
              >
                ↓
              </button>
            </div>
            <button type="button" class="button ghost survey-q__remove" @click="removeQuestion(idx)">
              Удалить
            </button>
          </div>

          <input
            v-model="q.text"
            type="text"
            class="survey-builder__input survey-q__text"
            :placeholder="q.type === 'info' ? 'Текст блока' : 'Текст вопроса'"
          />

          <div v-if="q.type === 'single' || q.type === 'multi'" class="survey-q__options">
            <div v-for="(opt, oIdx) in q.options" :key="oIdx" class="survey-q__option-row">
              <input
                v-model="q.options![oIdx]"
                type="text"
                class="survey-builder__input"
                :placeholder="`Вариант ${oIdx + 1}`"
              />
              <button
                type="button"
                class="button ghost"
                :disabled="(q.options?.length ?? 0) <= 2"
                @click="removeOption(q, oIdx)"
              >
                ×
              </button>
            </div>
            <button type="button" class="button ghost" @click="addOption(q)">+ Вариант</button>
          </div>

          <div v-else-if="q.type === 'scale'" class="survey-q__scale-config">
            <label>
              От
              <input v-model.number="q.scaleMin" type="number" class="survey-builder__input survey-q__scale-input" />
            </label>
            <label>
              До
              <input v-model.number="q.scaleMax" type="number" class="survey-builder__input survey-q__scale-input" />
            </label>
          </div>

          <label v-if="q.type !== 'info'" class="survey-q__required">
            <input v-model="q.required" type="checkbox" /> Обязательный вопрос
          </label>
        </div>

        <div class="survey-builder__add-row">
          <select v-model="newQuestionType" class="survey-q__type-select">
            <option v-for="t in SURVEY_QUESTION_TYPES" :key="t" :value="t">
              {{ SURVEY_QUESTION_TYPE_LABELS[t] }}
            </option>
          </select>
          <button type="button" class="button primary" @click="addQuestion">+ Добавить вопрос</button>
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
const newQuestionType = ref<SurveyQuestionType>('single');
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');

const applySurvey = (s: Survey) => {
  survey.value = s;
  title.value = s.title;
  description.value = s.description || '';
  anonymous.value = s.anonymous;
  questions.value = s.questions.map((q) => ({ ...q, options: q.options ? [...q.options] : undefined }));
};

const result = await fetchOne(id);
if (result) applySurvey(result);
loaded.value = true;

const genId = () => {
  if (import.meta.client && 'randomUUID' in crypto) return `q-${crypto.randomUUID()}`;
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const addQuestion = () => {
  questions.value.push({ id: genId(), ...defaultQuestionForType(newQuestionType.value) });
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

const copyLink = async () => {
  if (!survey.value) return;
  try {
    await navigator.clipboard.writeText(publicUrl(survey.value.slug));
  } catch {
    /* буфер обмена недоступен — ссылка уже видна в поле */
  }
};
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
  gap: 16px;
}

.survey-builder .card {
  border: 1px solid var(--sv-border);
  border-radius: var(--sv-radius);
  box-shadow: none;
  background: #fff;
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
  gap: 6px;
  margin-top: 14px;
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
  padding: 10px 14px;
  font-size: 0.95rem;
  font-family: var(--font-body);
  background: var(--bg-surface);
  color: var(--text);
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
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
  margin-top: 14px;
  font-size: 0.88rem;
  font-weight: 600;
}

.survey-builder__link {
  margin-top: 14px;
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
  padding: 16px;
  margin-bottom: 12px;
  display: grid;
  gap: 10px;
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

.survey-q__remove {
  margin-left: auto;
}

.survey-q__options {
  display: grid;
  gap: 6px;
}

.survey-q__option-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.survey-q__option-row .survey-builder__input {
  flex: 1;
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

.survey-q__required {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}

.survey-builder__empty {
  margin-bottom: 12px;
}

.survey-builder__add-row {
  display: flex;
  gap: 10px;
  align-items: center;
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
