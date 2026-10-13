<template>
  <div class="survey-results">
    <div v-if="!loaded" class="card section-card muted">Загрузка…</div>

    <template v-else-if="data">
      <section class="card section-card survey-results__hero">
        <div class="survey-results__head">
          <NuxtLink to="/admin/surveys" class="button ghost">← Все опросы</NuxtLink>
          <h2 class="section-title">{{ data.survey.title }}</h2>
        </div>

        <div class="survey-results__funnel">
          <div class="survey-stat-tile">
            <span class="survey-stat-tile__value">{{ data.results.started }}</span>
            <span class="survey-stat-tile__label">Начали</span>
          </div>
          <div class="survey-stat-tile survey-stat-tile--accent">
            <span class="survey-stat-tile__value">{{ data.results.completed }}</span>
            <span class="survey-stat-tile__label">Завершили</span>
          </div>
          <div class="survey-stat-tile">
            <span class="survey-stat-tile__value">{{ data.results.completionRate }}%</span>
            <span class="survey-stat-tile__label">Конверсия</span>
          </div>
        </div>
      </section>

      <section
        v-for="q in data.results.questions"
        :key="q.questionId"
        class="card section-card survey-results__question"
      >
        <h3 class="survey-results__q-title">{{ q.text || '(без текста)' }}</h3>

        <p v-if="q.kind === 'info'" class="muted">Информационный блок — без ответов.</p>

        <template v-else-if="q.kind === 'distribution'">
          <p class="muted survey-results__answered">
            Ответили: {{ q.answered }}
            <span v-if="q.average !== undefined"> · среднее: {{ q.average }}</span>
          </p>
          <div v-if="!q.buckets.length" class="muted">Нет ответов.</div>
          <div v-else class="survey-bars">
            <div v-for="b in q.buckets" :key="b.label" class="survey-bar-row">
              <span class="survey-bar-row__label">{{ b.label }}</span>
              <div class="survey-bar-row__track">
                <div class="survey-bar-row__fill" :style="{ width: `${b.percent}%` }" />
              </div>
              <span class="survey-bar-row__value">{{ b.count }} · {{ b.percent }}%</span>
            </div>
          </div>
        </template>

        <template v-else-if="q.kind === 'text'">
          <p class="muted survey-results__answered">Ответили: {{ q.answered }}</p>
          <div v-if="!q.values.length" class="muted">Нет ответов.</div>
          <ul v-else class="survey-results__text-list">
            <li v-for="(v, i) in q.values" :key="i">{{ v }}</li>
          </ul>
        </template>
      </section>
    </template>

    <div v-else class="card section-card muted">Опрос не найден.</div>
  </div>
</template>

<script setup lang="ts">
import type { Survey } from '~/composables/useSurveys';
import type { SurveyResultsSummary } from '../../../../../server/utils/surveyResults';

const route = useRoute();
const id = String(route.params.id || '');
const { fetchResults } = useAdminSurveys();

const loaded = ref(false);
const data = ref<{ survey: Survey; results: SurveyResultsSummary } | null>(null);

data.value = await fetchResults(id);
loaded.value = true;
</script>

<style scoped>
.survey-results {
  display: grid;
  gap: 16px;
}

.survey-results__head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.survey-results__head .section-title {
  margin: 0;
}

.survey-results__funnel {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.survey-stat-tile {
  border: 1px solid var(--border-brutal);
  border-radius: 10px;
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 120px;
}

.survey-stat-tile--accent {
  background: var(--accent-lime);
}

.survey-stat-tile__value {
  font-size: 1.6rem;
  font-weight: 800;
}

.survey-stat-tile__label {
  font-size: 0.78rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.survey-results__q-title {
  margin: 0 0 4px;
  font-size: 1rem;
}

.survey-results__answered {
  margin: 0 0 10px;
  font-size: 0.82rem;
}

.survey-bars {
  display: grid;
  gap: 8px;
}

.survey-bar-row {
  display: grid;
  grid-template-columns: 140px 1fr 110px;
  align-items: center;
  gap: 10px;
}

.survey-bar-row__label {
  font-size: 0.82rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.survey-bar-row__track {
  height: 10px;
  background: var(--bg-elevated);
  border-radius: 4px;
  overflow: hidden;
}

.survey-bar-row__fill {
  height: 100%;
  background: var(--hero-purple, #7451f4);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.survey-bar-row__value {
  font-size: 0.78rem;
  color: var(--text-muted);
  text-align: right;
}

.survey-results__text-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 18px;
  font-size: 0.86rem;
}
</style>
