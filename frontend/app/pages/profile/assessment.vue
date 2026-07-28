<template>
  <section class="creative-hero profile-hero">
    <div>
      <p class="eyebrow">Оценка · шаблон HR</p>
      <h2>Матрица компетенций</h2>
      <p class="muted">
        {{ assessment.roleTitle }} · текущий грейд
        <strong>{{ gradeById(assessment.currentGradeId)?.title }}</strong>
        · цель
        <strong>{{ gradeById(assessment.targetGradeId)?.title }}</strong>
      </p>
      <p class="soft">Последняя оценка: {{ assessment.lastReviewDate }}</p>
    </div>
  </section>

  <section class="card section-card assessment-matrix-section">
    <div class="section-head row">
      <div>
        <h3 class="section-title">Уровни по грейдам</h3>
        <p class="muted">
          Столбцы — ожидаемый уровень для грейда.
          «{{ hasTestResults ? 'Тест' : 'Моя оценка' }}» — {{ hasTestResults ? 'результаты HR-теста' : 'самооценка до прохождения теста' }}.
        </p>
      </div>
      <div class="assessment-matrix-actions">
        <NuxtLink
          v-if="!hasTestResults"
          to="/tasks/hr-assessment"
          class="button primary"
        >
          Пройти тест
        </NuxtLink>
      </div>
    </div>

    <div class="assessment-layout">
      <div class="assessment-layout__table competency-matrix-wrap">
        <table class="competency-matrix">
          <thead>
            <tr>
              <th scope="col">Компетенция</th>
              <th v-for="grade in grades" :key="grade.id" scope="col">{{ grade.shortLabel }}</th>
              <th scope="col">{{ hasTestResults ? 'Тест' : 'Моя оценка' }}</th>
              <th scope="col">Разрыв</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="category in competencyCategories" :key="category">
              <tr class="competency-matrix__category">
                <td :colspan="grades.length + 3">{{ category }}</td>
              </tr>
              <tr v-for="comp in competenciesByCategory(category)" :key="comp.id">
                <th scope="row">
                  <span class="competency-matrix__name">{{ comp.name }}</span>
                  <span class="competency-matrix__hint muted">{{ comp.description }}</span>
                </th>
                <td
                  v-for="grade in grades"
                  :key="`${comp.id}-${grade.id}`"
                  :class="{
                    'is-target-grade': grade.id === assessment.targetGradeId,
                    'is-current-grade': grade.id === assessment.currentGradeId
                  }"
                >
                  <CompetencyLevelBadge :level="expectationFor(grade.id, comp.id)" />
                </td>
                <td>
                  <CompetencyLevelBadge :level="selfRating(comp.id)" emphasis />
                </td>
                <td>
                  <span
                    v-if="gapToTarget(comp.id) > 0"
                    class="competency-gap-chip"
                  >
                    −{{ gapToTarget(comp.id) }}
                  </span>
                  <span v-else class="status-chip done">OK</span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <aside class="assessment-radar-panel creative-hero">
        <div class="assessment-radar-panel__inner">
          <h3 class="section-title">Профиль компетенций</h3>
          <p class="muted">Шкала 1–10 по блокам HR-теста</p>
          <CompetencyRadarChart
            :labels="radarLabels"
            :values="radarValues"
            :legend="radarLegend"
          />
          <p v-if="!hasTestResults" class="assessment-radar-panel__cta muted">
            Пройдите тест в разделе «Задачи», чтобы заполнить диаграмму.
          </p>
          <p v-else-if="testResult" class="soft">
            Общий балл: {{ testResult.overallPercent }}% · {{ testResult.completedAt }}
          </p>
        </div>
      </aside>
    </div>
  </section>

  <section v-if="gapsForTarget.length" class="card section-card profile-gaps-card">
    <h3 class="section-title">Приоритетные пробелы</h3>
    <p class="muted">Компетенции ниже целевого уровня для {{ gradeById(assessment.targetGradeId)?.title }}.</p>
    <ul class="list-reset profile-gaps-list">
      <li v-for="row in gapsForTarget" :key="row.competency.id" class="profile-gap-item">
        <div>
          <strong>{{ row.competency.name }}</strong>
          <p class="muted">
            Сейчас {{ competencyLevelLabels[row.current as CompetencyLevel] }} → нужно
            {{ competencyLevelLabels[row.required as CompetencyLevel] }}
          </p>
        </div>
        <span class="competency-gap-chip">−{{ row.gap }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { CompetencyLevel } from '~/composables/useHrDevelopment';
import { competencyLevelLabels } from '~/composables/useHrDevelopment';

const {
  competencies,
  grades,
  assessment,
  gradeById,
  expectationFor,
  gapsForTarget,
  hasTestResults,
  testResult,
  radarLabels,
  radarValues,
  radarLegend
} = useHrDevelopment();

const competencyCategories = computed(() => [...new Set(competencies.map((c) => c.category))]);

const competenciesByCategory = (category: string) => competencies.filter((c) => c.category === category);

const selfRating = (competencyId: string): CompetencyLevel =>
  (assessment.value.selfRatings[competencyId] ?? 0) as CompetencyLevel;

const gapToTarget = (competencyId: string) => {
  const snapshot = assessment.value;
  const required = expectationFor(snapshot.targetGradeId, competencyId);
  const current = selfRating(competencyId);
  return Math.max(0, required - current);
};
</script>
