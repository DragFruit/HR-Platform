<template>
  <div class="pub-survey">
    <div class="pub-survey__box">
      <div v-if="result.state === 'loading'" class="pub-survey__state">Загрузка…</div>

      <div v-else-if="result.state === 'unavailable'" class="pub-survey__state">
        <p class="pub-survey__state-title">Опрос недоступен</p>
        <p class="pub-survey__state-text">
          Ссылка больше не активна, опрос завершён или не существует.
        </p>
      </div>

      <div v-else-if="submitted" class="pub-survey__state">
        <p class="pub-survey__state-title">Спасибо!</p>
        <p class="pub-survey__state-text">Ваш ответ сохранён.</p>
      </div>

      <form v-else class="pub-survey__form" @submit.prevent="onSubmit">
        <h1 class="pub-survey__title">{{ result.survey.title }}</h1>
        <p v-if="result.survey.description" class="pub-survey__desc">{{ result.survey.description }}</p>

        <div v-for="q in result.survey.questions" :key="q.id" class="pub-q">
          <p v-if="q.type === 'info'" class="pub-q__info">{{ q.text }}</p>

          <template v-else>
            <label class="pub-q__label">
              {{ q.text }}
              <span v-if="q.required" class="pub-q__req" aria-hidden="true">*</span>
            </label>

            <!-- single -->
            <div v-if="q.type === 'single'" class="pub-q__options">
              <label v-for="opt in q.options" :key="opt" class="pub-q__option">
                <input
                  type="radio"
                  :name="q.id"
                  :value="opt"
                  v-model="answers[q.id]"
                />
                {{ opt }}
              </label>
            </div>

            <!-- multi -->
            <div v-else-if="q.type === 'multi'" class="pub-q__options">
              <label v-for="opt in q.options" :key="opt" class="pub-q__option">
                <input
                  type="checkbox"
                  :value="opt"
                  :checked="isMultiChecked(q.id, opt)"
                  @change="toggleMulti(q.id, opt)"
                />
                {{ opt }}
              </label>
            </div>

            <!-- yes/no -->
            <div v-else-if="q.type === 'yesno'" class="pub-q__row">
              <label class="pub-q__option">
                <input type="radio" :name="q.id" :value="true" v-model="answers[q.id]" /> Да
              </label>
              <label class="pub-q__option">
                <input type="radio" :name="q.id" :value="false" v-model="answers[q.id]" /> Нет
              </label>
            </div>

            <!-- smiley -->
            <div v-else-if="q.type === 'smiley'" class="pub-q__smiley">
              <button
                v-for="(label, idx) in smileyLabelsFor(q)"
                :key="idx"
                type="button"
                class="pub-q__smiley-btn"
                :class="{ 'is-active': answers[q.id] === idx + 1 }"
                :aria-label="label"
                @click="answers[q.id] = idx + 1"
              >
                <span class="pub-q__smiley-face">{{ smileyEmojiAt(idx, smileyLabelsFor(q).length) }}</span>
                <span class="pub-q__smiley-label">{{ label }}</span>
              </button>
            </div>

            <!-- nps -->
            <div v-else-if="q.type === 'nps'" class="pub-q__scale">
              <button
                v-for="n in 11"
                :key="n - 1"
                type="button"
                class="pub-q__scale-btn"
                :class="{ 'is-active': answers[q.id] === n - 1 }"
                @click="answers[q.id] = n - 1"
              >
                {{ n - 1 }}
              </button>
              <div class="pub-q__scale-hints">
                <span>{{ q.npsLowLabel || NPS_DEFAULT_LOW_LABEL }}</span>
                <span>{{ q.npsHighLabel || NPS_DEFAULT_HIGH_LABEL }}</span>
              </div>
            </div>

            <!-- scale -->
            <div v-else-if="q.type === 'scale'" class="pub-q__scale">
              <button
                v-for="n in scaleNumbers(q)"
                :key="n"
                type="button"
                class="pub-q__scale-btn"
                :class="{ 'is-active': answers[q.id] === n }"
                @click="answers[q.id] = n"
              >
                {{ n }}
              </button>
            </div>

            <!-- text short -->
            <input
              v-else-if="q.type === 'text_short'"
              v-model="answers[q.id]"
              type="text"
              class="pub-q__input"
              maxlength="500"
            />

            <!-- text long -->
            <textarea
              v-else-if="q.type === 'text_long'"
              v-model="answers[q.id]"
              class="pub-q__textarea"
              rows="4"
              maxlength="5000"
            />
          </template>
        </div>

        <p v-if="formError" class="pub-survey__error">{{ formError }}</p>

        <button type="submit" class="pub-survey__submit" :disabled="submitting">
          {{ submitting ? 'Отправка…' : 'Отправить' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SurveyAnswerValue, SurveyQuestion } from '~/composables/useSurveys';
import {
  SMILEY_LABELS,
  smileyEmojiAt,
  NPS_DEFAULT_LOW_LABEL,
  NPS_DEFAULT_HIGH_LABEL
} from '~/composables/useSurveys';

function smileyLabelsFor(q: SurveyQuestion): string[] {
  return q.smileyLabels?.length ? q.smileyLabels : [...SMILEY_LABELS];
}

const route = useRoute();
const slug = String(route.params.slug || '');

useHead({ title: 'Опрос' });

const { result, load, submit, submitting, submitted, submitError } = useSurveyRespond(slug);
const answers = reactive<Record<string, SurveyAnswerValue>>({});
const formError = ref('');

await load();

function isMultiChecked(qid: string, opt: string): boolean {
  const v = answers[qid];
  return Array.isArray(v) && v.includes(opt);
}

function toggleMulti(qid: string, opt: string) {
  const current = Array.isArray(answers[qid]) ? [...(answers[qid] as string[])] : [];
  const idx = current.indexOf(opt);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(opt);
  answers[qid] = current;
}

function scaleNumbers(q: SurveyQuestion): number[] {
  const min = q.scaleMin ?? 1;
  const max = q.scaleMax ?? 10;
  const out: number[] = [];
  for (let i = min; i <= max; i += 1) out.push(i);
  return out;
}

function hasValue(v: SurveyAnswerValue | undefined): boolean {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

async function onSubmit() {
  formError.value = '';
  if (result.value.state !== 'ready') return;

  for (const q of result.value.survey.questions) {
    if (q.type !== 'info' && q.required && !hasValue(answers[q.id])) {
      formError.value = 'Ответьте на все обязательные вопросы (отмечены *).';
      return;
    }
  }

  const ok = await submit(answers);
  if (!ok) {
    formError.value = submitError.value;
  }
}
</script>

<style scoped>
/*
  Нейтральный стиль специально НЕ использует брендинг Vibe (лайм/фиолетовый,
  шрифты платформы) — страница должна читаться как отдельный инструмент опросов,
  а не как часть корпоративной платформы.
*/
.pub-survey {
  min-height: 100vh;
  width: 100%;
  background: #f4f5f7;
  display: flex;
  justify-content: center;
  padding: 32px 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1f2430;
  box-sizing: border-box;
}

.pub-survey__box {
  width: 100%;
  max-width: 560px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e4ea;
  box-shadow: 0 1px 3px rgba(20, 22, 30, 0.06);
  padding: 32px 28px;
}

.pub-survey__state {
  text-align: center;
  padding: 24px 0;
  color: #4b5160;
}

.pub-survey__state-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #1f2430;
}

.pub-survey__state-text {
  margin: 0;
  font-size: 14px;
}

.pub-survey__title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px;
}

.pub-survey__desc {
  font-size: 14px;
  color: #5a6072;
  margin: 0 0 24px;
}

.pub-q {
  margin-bottom: 22px;
}

.pub-q__label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
}

.pub-q__req {
  color: #c2402f;
}

.pub-q__info {
  font-size: 14px;
  color: #444a58;
  background: #f0f1f4;
  border-radius: 8px;
  padding: 12px 14px;
  margin: 0;
}

.pub-q__options,
.pub-q__row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pub-q__row {
  flex-direction: row;
  gap: 20px;
}

.pub-q__option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
}

.pub-q__input,
.pub-q__textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d7d9e0;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  color: #1f2430;
}

.pub-q__textarea {
  resize: vertical;
}

.pub-q__smiley {
  display: flex;
  justify-content: space-between;
  gap: 4px;
}

.pub-q__smiley-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: 1px solid #e2e4ea;
  border-radius: 10px;
  background: #fff;
  padding: 10px 2px;
  cursor: pointer;
  font-size: 11px;
  color: #5a6072;
}

.pub-q__smiley-btn.is-active {
  border-color: #3b6dd8;
  background: #eef3fd;
  color: #26436f;
}

.pub-q__smiley-face {
  font-size: 22px;
}

.pub-q__scale {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pub-q__scale-btn {
  min-width: 36px;
  height: 36px;
  border: 1px solid #d7d9e0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #1f2430;
}

.pub-q__scale-btn.is-active {
  background: #3b6dd8;
  border-color: #3b6dd8;
  color: #fff;
}

.pub-q__scale-hints {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #8a8f9c;
  margin-top: 4px;
}

.pub-survey__error {
  color: #c2402f;
  font-size: 13px;
  margin: 0 0 12px;
}

.pub-survey__submit {
  width: 100%;
  background: #3b6dd8;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.pub-survey__submit:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
