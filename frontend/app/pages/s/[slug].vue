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

      <SurveysRespondForm
        v-else
        :survey="result.survey"
        :submitting="submitting"
        :submitted="submitted"
        :error-message="submitError"
        @submit="onSubmit"
        @started="recordStart"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SurveyAnswerValue } from '~/composables/useSurveys';

const route = useRoute();
const slug = String(route.params.slug || '');

useHead({ title: 'Опрос' });

const { result, load, recordVisit, recordStart, submit, submitting, submitted, submitError } =
  useSurveyRespond(slug);

await load();

// Визит фиксируем один раз на клиенте после загрузки опроса — не на SSR-рендере
// и не повторно при hydration. Если опрос недоступен, visit-эндпойнт сам не
// засчитает его (см. visit.post.ts), но мы и не дёргаем его в этом случае.
onMounted(() => {
  if (result.value.state === 'ready') {
    void recordVisit();
  }
});

async function onSubmit(answers: Record<string, SurveyAnswerValue>) {
  await submit(answers);
}
</script>

<style scoped>
/*
  Нейтральный стиль специально НЕ использует брендинг Vibe (лайм/фиолетовый,
  шрифты платформы) — страница должна читаться как отдельный инструмент опросов,
  а не как часть корпоративной платформы. Рендер самой формы вопросов — в
  components/surveys/RespondForm.vue, общий с админским предпросмотром
  (/admin/surveys/[id]/preview), чтобы превью никогда не расходилось с тем,
  что видит респондент.
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
</style>
