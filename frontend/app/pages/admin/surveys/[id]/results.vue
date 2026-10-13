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
            <span class="survey-stat-tile__value">{{ data.results.visited }}</span>
            <span class="survey-stat-tile__label">Посещения</span>
          </div>
          <div class="survey-stat-tile survey-stat-tile--accent">
            <span class="survey-stat-tile__value">{{ data.results.completed }}</span>
            <span class="survey-stat-tile__label">Завершили</span>
          </div>
          <div class="survey-stat-tile">
            <span class="survey-stat-tile__value">{{ data.results.startedButNotCompleted }}</span>
            <span class="survey-stat-tile__label">Не закончили</span>
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
/*
 * Опросы (админка) — осознанное исключение из общего necroбрутализма платформы,
 * ближе к референсу webask.io. См. комментарий в admin/surveys/index.vue и CHANGELOG.
 */
.survey-results {
  --sv-accent: #4f6ef7;
  --sv-accent-soft: rgba(79, 110, 247, 0.12);
  --sv-border: #e5e5e8;
  --sv-muted: #6b7280;
  --sv-radius: 14px;
  display: grid;
  gap: 16px;
}

.survey-results .card {
  border: 1px solid var(--sv-border);
  border-radius: var(--sv-radius);
  box-shadow: none;
  background: #fff;
}

.survey-results .card::before {
  display: none;
}

.survey-results .section-title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.survey-results .muted {
  font-size: 0.92rem;
  color: var(--sv-muted);
}

.survey-results .button.ghost {
  border-radius: 10px;
  text-transform: none;
  letter-spacing: normal;
  font-size: 0.92rem;
  font-weight: 600;
  padding: 9px 20px;
  border: 1px solid var(--sv-border);
  color: var(--text);
}

.survey-results .button.ghost:hover {
  background: #f7f7f8;
  border-color: var(--sv-border);
  color: var(--text);
  transform: none;
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
  border: 1px solid var(--sv-border);
  border-radius: 12px;
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 120px;
}

.survey-stat-tile--accent {
  background: var(--sv-accent-soft);
  border-color: transparent;
}

.survey-stat-tile__value {
  font-size: 1.6rem;
  font-weight: 700;
}

.survey-stat-tile__label {
  font-size: 0.78rem;
  color: var(--sv-muted);
  text-transform: none;
  letter-spacing: normal;
}

.survey-results__q-title {
  margin: 0 0 4px;
  font-size: 1.05rem;
  font-weight: 600;
}

.survey-results__answered {
  margin: 0 0 10px;
  font-size: 0.85rem;
  color: var(--sv-muted);
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
  font-size: 0.85rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.survey-bar-row__track {
  height: 8px;
  background: #eceef2;
  border-radius: 4px;
  overflow: hidden;
}

.survey-bar-row__fill {
  height: 100%;
  background: var(--sv-accent);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.survey-bar-row__value {
  font-size: 0.8rem;
  color: var(--sv-muted);
  text-align: right;
}

.survey-results__text-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 18px;
  font-size: 0.9rem;
}
</style>
