<template>
  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h2 class="section-title">Результаты тестов адаптации</h2>
        <p class="muted">
          Все попытки сохраняются на сервере с привязкой к сотруднику. Новые отмечены как непросмотренные.
        </p>
      </div>
      <span v-if="unseenCount > 0" class="tag learning">{{ unseenCount }} новых</span>
    </div>

    <div class="inline-controls" style="margin-top: 12px">
      <label class="check-row">
        <input v-model="onlyUnseen" type="checkbox" @change="reload" />
        <span>Только непросмотренные</span>
      </label>
      <select v-model="phaseFilter" class="table-input" @change="reload">
        <option value="">Все этапы</option>
        <option v-for="(label, key) in phaseLabels" :key="key" :value="key">{{ label }}</option>
      </select>
      <button class="button ghost" type="button" @click="reload">Обновить</button>
    </div>
  </section>

  <p v-if="error" class="gift-error">{{ error }}</p>
  <p v-if="loading" class="muted">Загрузка...</p>

  <section v-else-if="adminAttempts.length" class="card section-card">
    <ul class="list-reset adaptation-attempts-list">
      <li v-for="attempt in adminAttempts" :key="attempt.id" class="task-item attempt-row">
        <div class="row">
          <div>
            <strong>{{ attempt.employee_name }}</strong>
            <span v-if="!attempt.admin_seen" class="tag learning">новое</span>
            <p class="muted">
              {{ getPhaseLabel(attempt.phase) }} · {{ attempt.quiz_title }}
            </p>
            <p class="soft">
              {{ formatDate(attempt.submitted_at) }} · {{ attempt.score_percent }}%
              · {{ attempt.passed ? 'пройден' : 'не пройден' }}
            </p>
          </div>
          <div class="row">
            <button
              class="button ghost"
              type="button"
              @click="toggleExpand(attempt.id)"
            >
              {{ expandedId === attempt.id ? 'Скрыть' : 'Ответы' }}
            </button>
            <button
              v-if="!attempt.admin_seen"
              class="button primary"
              type="button"
              @click="markSeen(attempt.id)"
            >
              Просмотрено
            </button>
          </div>
        </div>

        <ul v-if="expandedId === attempt.id" class="list-reset attempt-answers">
          <li v-for="ans in attempt.answers" :key="ans.question_id" class="soft">
            <strong>{{ ans.question_id }}</strong>:
            {{ formatAnswer(ans.value) }}
          </li>
        </ul>
      </li>
    </ul>
  </section>

  <p v-else class="muted section-card">Попыток пока нет. Попросите новичка пройти тест на /adaptation.</p>
</template>

<script setup lang="ts">
const {
  adminAttempts,
  unseenCount,
  loading,
  error,
  loadAdminAttempts,
  markSeen: markSeenApi,
  getPhaseLabel,
  phaseLabels
} = useAdaptation();

const onlyUnseen = ref(false);
const phaseFilter = ref('');
const expandedId = ref<string | null>(null);

const reload = () => {
  loadAdminAttempts({
    unseen: onlyUnseen.value || undefined,
    phase: phaseFilter.value || undefined
  }).catch(() => {});
};

const toggleExpand = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id;
};

const markSeen = async (id: string) => {
  await markSeenApi(id);
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
};

const formatAnswer = (value: string | string[] | number) => {
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
};

onMounted(() => reload());
</script>
