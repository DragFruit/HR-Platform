<template>
  <section class="page-hero creative-hero">
    <div>
      <p class="eyebrow">Адаптация новых сотрудников</p>
      <h2>{{ me?.track.title ?? 'Трек адаптации' }}</h2>
      <p v-if="me?.scenario" class="soft">
        Сценарий: <strong>{{ me.scenario.short_title }}</strong>
        — {{ me.scenario.description }}
      </p>
      <p v-if="me?.employee" class="muted">
        {{ formatEmployeeShortName(me.employee.name) }} · {{ me.employee.title }} · старт {{ me.employee.hired_at }}
      </p>
      <p v-else class="gift-error">
        Профиль не привязан к справочнику сотрудников. Войдите как
        <strong>alina@vbi.local</strong> или попросите HR добавить связь.
      </p>
      <div v-if="me?.employee" class="progress-block">
        <div class="row">
          <span class="soft">Прогресс адаптации</span>
          <span class="tag learning">{{ me.progress_percent }}%</span>
        </div>
        <div class="progress"><span :style="{ width: `${me.progress_percent}%` }" /></div>
      </div>
    </div>
  </section>

  <p v-if="error" class="gift-error section-card">{{ error }}</p>
  <p v-if="loading && !me" class="muted section-card">Загрузка трека...</p>

  <section v-if="activeQuiz" class="card section-card">
    <AdaptationQuizForm :quiz="activeQuiz" @cancel="activeQuiz = null" @done="onQuizDone" />
  </section>

  <AdaptationPhaseTimeline
    v-else-if="me"
    :phases="me.track.phases"
    :days-since-hire="me.days_since_hire"
    @start-quiz="activeQuiz = $event"
    @complete-step="onCompleteStep"
  />
</template>

<script setup lang="ts">
import type { AdaptationQuizClient } from '~/composables/useAdaptation';
import { formatEmployeeShortName } from '~/utils/employeeName';

const { me, loading, error, loadMe, completeStep } = useAdaptation();
const activeQuiz = ref<AdaptationQuizClient | null>(null);

const onQuizDone = async () => {
  activeQuiz.value = null;
  await loadMe();
};

const onCompleteStep = async (stepId: string) => {
  try {
    await completeStep(stepId);
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string };
    error.value = err.data?.statusMessage ?? err.message ?? 'Не удалось отметить шаг';
  }
};

onMounted(() => {
  loadMe().catch(() => {});
});
</script>
