<template>
  <div class="survey-preview">
    <div class="survey-preview__bar">
      <NuxtLink :to="`/admin/surveys/${id}`" class="button ghost">← К конструктору</NuxtLink>
      <span class="survey-preview__badge">Предпросмотр — ответ не сохраняется</span>
    </div>

    <div v-if="!loaded" class="card section-card muted">Загрузка…</div>

    <div v-else-if="!survey" class="card section-card muted">Опрос не найден.</div>

    <div v-else class="pub-survey">
      <div class="pub-survey__box">
        <SurveysRespondForm :survey="survey" :submitted="submitted" preview @submit="onSubmit" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Survey, SurveyAnswerValue } from '~/composables/useSurveys';

/**
 * Админский предпросмотр опроса — рендерит ТЕКУЩЕЕ сохранённое состояние
 * (включая draft, ещё не опубликованный) через тот же SurveysRespondForm,
 * что и публичная страница /s/[slug]. Доступ — через авторизованный
 * GET /api/surveys/:id (requireRole admin/hr), не через публичный API,
 * потому что у черновика нет публичного slug-доступа.
 *
 * Отправка формы здесь НИКОГДА не уходит в POST /api/public/surveys/.../submit —
 * клик "Отправить" просто показывает заглушку превью, без записи в
 * survey-responses.json.
 */
const route = useRoute();
const id = String(route.params.id || '');

useHead({ title: 'Предпросмотр опроса' });

const { fetchOne } = useAdminSurveys();

const survey = ref<Survey | null>(null);
const loaded = ref(false);
const submitted = ref(false);

const result = await fetchOne(id);
survey.value = result;
loaded.value = true;

function onSubmit(_answers: Record<string, SurveyAnswerValue>) {
  submitted.value = true;
}
</script>

<style scoped>
.survey-preview {
  display: grid;
  gap: 16px;
}

.survey-preview__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.survey-preview__badge {
  font-size: 0.82rem;
  font-weight: 600;
  color: #946200;
  background: #fff3cd;
  border: 1px solid #ffe29a;
  border-radius: 999px;
  padding: 5px 14px;
}

.pub-survey {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 16px 0 32px;
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
</style>
