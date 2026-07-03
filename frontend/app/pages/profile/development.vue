<template>
  <section class="creative-hero profile-hero">
    <div>
      <p class="eyebrow">Развитие · ИПР</p>
      <h2>Индивидуальный план развития</h2>
      <p class="muted">
        Цели закрывают пробелы матрицы до {{ gradeById(assessment.targetGradeId)?.title }}
      </p>
      <div class="progress-block" style="margin-top: 16px">
        <div class="row">
          <span class="soft">Прогресс активностей</span>
          <span class="tag learning">{{ idpProgress }}%</span>
        </div>
        <div class="progress"><span :style="{ width: `${idpProgress}%` }" /></div>
      </div>
    </div>
  </section>

  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h3 class="section-title">Связь с матрицей</h3>
        <p class="muted">Каждая цель привязана к компетенции из оценки.</p>
      </div>
      <NuxtLink to="/profile/assessment" class="button ghost">Матрица компетенций</NuxtLink>
    </div>

    <div class="idp-goals">
      <article v-for="goal in idpGoals" :key="goal.id" class="idp-goal-card">
        <div class="idp-goal-card__head">
          <div>
            <p class="eyebrow">{{ competencyById(goal.competencyId)?.name }}</p>
            <h4 class="section-title">{{ goal.title }}</h4>
            <p class="muted">
              Уровень {{ competencyLevelLabels[goal.gapFrom] }} → {{ competencyLevelLabels[goal.gapTo] }}
              · до {{ goal.dueDate }}
            </p>
          </div>
          <span class="status-chip" :class="goalStatusClass(goal.status)">{{ goalStatusLabel(goal.status) }}</span>
        </div>

        <div class="idp-702010">
          <div v-for="bucket in idpBuckets" :key="bucket" class="idp-bucket">
            <h5>{{ idpBucketLabels[bucket] }}</h5>
            <ul class="list-reset">
              <li
                v-for="activity in activitiesForGoal(goal.id).filter((a) => a.bucket === bucket)"
                :key="activity.id"
                class="idp-activity"
                :class="{ done: activity.done }"
              >
                <span class="idp-activity__check" aria-hidden="true">{{ activity.done ? '✓' : '○' }}</span>
                <div>
                  <strong>{{ activity.title }}</strong>
                  <p class="muted">{{ activity.detail }}</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </article>
    </div>
  </section>

  <section class="card section-card">
    <h3 class="section-title">Контрольные точки</h3>
    <p class="muted">Review с руководителем и HR по ходу ИПР.</p>
    <ul class="timeline list-reset" style="margin-top: 16px">
      <li
        v-for="cp in idpCheckpoints"
        :key="cp.id"
        class="timeline-item"
        :class="cp.status === 'done' ? 'done' : 'active'"
      >
        <div class="timeline-dot" />
        <div>
          <strong>{{ cp.title }}</strong>
          <p class="muted">{{ cp.date }} · {{ cp.note }}</p>
        </div>
        <span class="status-chip" :class="cp.status === 'done' ? 'done' : 'pending'">
          {{ cp.status === 'done' ? 'Пройдено' : 'Запланировано' }}
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { IdpGoal } from '~/composables/useHrDevelopment';
import { competencyLevelLabels, idpBucketLabels } from '~/composables/useHrDevelopment';

const {
  assessment,
  gradeById,
  idpGoals,
  idpCheckpoints,
  competencyById,
  activitiesForGoal,
  idpProgress
} = useHrDevelopment();

const idpBuckets = ['70', '20', '10'] as const;

const goalStatusLabel = (status: IdpGoal['status']) => {
  if (status === 'done') return 'Выполнено';
  if (status === 'in_progress') return 'В работе';
  return 'Запланировано';
};

const goalStatusClass = (status: IdpGoal['status']) => {
  if (status === 'done') return 'done';
  if (status === 'in_progress') return 'active';
  return 'pending';
};
</script>
