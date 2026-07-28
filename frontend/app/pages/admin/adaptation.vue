<template>
  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h2 class="section-title">Сценарии адаптации</h2>
        <p class="muted">
          Создавайте и редактируйте треки, затем назначайте новичку. К базовым шагам 90 дней
          добавляются задачи сценария.
        </p>
      </div>
      <button type="button" class="button primary" @click="openCreate">Новый сценарий</button>
    </div>

    <div class="adaptation-scenarios-grid">
      <article
        v-for="scenario in scenarios"
        :key="scenario.id"
        class="card adaptation-scenario-card"
        :class="{ 'adaptation-scenario-card--selected': assignForm.scenario_id === scenario.id }"
      >
        <h3 class="adaptation-scenario-card__title">{{ scenario.title }}</h3>
        <p class="muted adaptation-scenario-card__audience">{{ scenario.audience }}</p>
        <p class="soft adaptation-scenario-card__desc">{{ scenario.description }}</p>
        <p class="muted adaptation-scenario-card__meta">
          +{{ countExtraSteps(scenario) }} доп. шагов · id: {{ scenario.id }}
        </p>
        <div class="adaptation-scenario-card__actions row">
          <button
            type="button"
            class="button"
            :class="assignForm.scenario_id === scenario.id ? 'primary' : 'ghost'"
            @click="assignForm.scenario_id = scenario.id"
          >
            {{ assignForm.scenario_id === scenario.id ? 'Выбран' : 'Выбрать' }}
          </button>
          <button type="button" class="button ghost" @click="openEdit(scenario)">Изменить</button>
          <button
            type="button"
            class="button ghost"
            :disabled="scenarios.length <= 1"
            @click="confirmDelete(scenario)"
          >
            Удалить
          </button>
        </div>
      </article>
    </div>

    <form class="adaptation-assign-form" @submit.prevent="submitAssign">
      <label class="adaptation-assign-form__field">
        <span>Сотрудник</span>
        <select v-model="assignForm.employee_id" class="table-input" required>
          <option disabled value="">Выберите сотрудника</option>
          <option v-for="emp in employeeOptions" :key="emp.id" :value="String(emp.id)">
            {{ emp.name }}{{ emp.department ? ` · ${emp.department}` : '' }}
          </option>
        </select>
      </label>
      <button
        type="submit"
        class="button primary"
        :disabled="!assignForm.scenario_id || !assignForm.employee_id || assigning"
      >
        {{ assigning ? 'Отправка…' : 'Назначить сценарий' }}
      </button>
    </form>

    <p v-if="assignError" class="gift-error">{{ assignError }}</p>
    <p v-if="assignOk" class="soft">Сценарий назначен — сотрудник увидит его на /adaptation.</p>

    <div v-if="assignments.length" class="adaptation-assignments">
      <h3 class="adaptation-assignments__title">Назначения</h3>
      <ul class="list-reset">
        <li v-for="row in assignments" :key="`${row.employee_id}-${row.assigned_at}`" class="soft">
          <strong>{{ row.employee_name }}</strong>
          → {{ scenarioTitle(row.scenario_id) }}
          <span class="muted"> · {{ formatDate(row.assigned_at) }}</span>
        </li>
      </ul>
    </div>
  </section>

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

  <Teleport to="body">
    <div
      v-if="editorOpen"
      class="org-confirm-overlay"
      role="presentation"
      @click.self="closeEditor"
    >
      <form
        class="card adaptation-scenario-editor"
        role="dialog"
        aria-modal="true"
        @submit.prevent="saveEditor"
        @click.stop
      >
        <div class="row adaptation-scenario-editor__head">
          <h3 class="org-confirm-title">
            {{ editorMode === 'create' ? 'Новый сценарий' : 'Редактирование сценария' }}
          </h3>
          <button type="button" class="button ghost" @click="closeEditor">Закрыть</button>
        </div>

        <div class="adaptation-scenario-editor__grid">
          <label class="adaptation-assign-form__field">
            <span>Название</span>
            <input v-model="editorForm.title" class="table-input" required minlength="3" />
          </label>
          <label class="adaptation-assign-form__field">
            <span>Короткое имя</span>
            <input v-model="editorForm.short_title" class="table-input" maxlength="40" />
          </label>
          <label v-if="editorMode === 'create'" class="adaptation-assign-form__field">
            <span>id (латиница)</span>
            <input
              v-model="editorForm.id"
              class="table-input"
              placeholder="авто из названия"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
          </label>
          <label class="adaptation-assign-form__field">
            <span>Аудитория</span>
            <input v-model="editorForm.audience" class="table-input" />
          </label>
        </div>

        <label class="adaptation-assign-form__field">
          <span>Описание</span>
          <textarea v-model="editorForm.description" class="table-input" rows="3" />
        </label>

        <div
          v-for="phase in phaseOptions"
          :key="phase.id"
          class="adaptation-scenario-editor__phase"
        >
          <div class="row">
            <strong>{{ phase.label }}</strong>
            <button type="button" class="button ghost" @click="addStep(phase.id)">
              + шаг
            </button>
          </div>
          <div
            v-for="(step, index) in editorForm.extra_steps_by_phase[phase.id]"
            :key="`${phase.id}-${index}`"
            class="adaptation-scenario-editor__step"
          >
            <input
              v-model="step.title"
              class="table-input"
              placeholder="Текст шага"
              required
            />
            <input
              v-model.number="step.due_day"
              class="table-input adaptation-scenario-editor__due"
              type="number"
              title="День от найма"
            />
            <select v-model="step.owner" class="table-input">
              <option v-for="owner in ownerOptions" :key="owner.id" :value="owner.id">
                {{ owner.label }}
              </option>
            </select>
            <button type="button" class="button ghost" @click="removeStep(phase.id, index)">
              ×
            </button>
          </div>
          <p
            v-if="!(editorForm.extra_steps_by_phase[phase.id] || []).length"
            class="muted soft"
          >
            Нет доп. шагов — только базовый трек.
          </p>
        </div>

        <p v-if="editorError" class="gift-error">{{ editorError }}</p>

        <div class="org-confirm-actions row">
          <button type="button" class="button ghost" @click="closeEditor">Отмена</button>
          <button type="submit" class="button primary" :disabled="editorSaving">
            {{ editorSaving ? 'Сохранение…' : 'Сохранить' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
type StepOwner = 'employee' | 'manager' | 'buddy' | 'hr';

type ScenarioStep = {
  id?: string;
  title: string;
  due_day: number;
  owner: StepOwner;
};

type Scenario = {
  id: string;
  title: string;
  short_title: string;
  description: string;
  audience: string;
  extra_steps_by_phase?: Record<string, ScenarioStep[]>;
};

type Assignment = {
  employee_id: number;
  employee_name: string;
  scenario_id: string;
  assigned_at: string;
};

type PhaseOption = { id: string; label: string };
type OwnerOption = { id: StepOwner; label: string };

const emptyExtras = () => ({
  pre_start: [] as ScenarioStep[],
  day_1: [] as ScenarioStep[],
  week_1: [] as ScenarioStep[],
  month_1: [] as ScenarioStep[],
  probation_90: [] as ScenarioStep[]
});

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

const { employees, hydrate: hydrateEmployees } = useEmployees();

const onlyUnseen = ref(false);
const phaseFilter = ref('');
const expandedId = ref<string | null>(null);

const scenarios = ref<Scenario[]>([]);
const assignments = ref<Assignment[]>([]);
const phaseOptions = ref<PhaseOption[]>([]);
const ownerOptions = ref<OwnerOption[]>([
  { id: 'employee', label: 'Сотрудник' },
  { id: 'manager', label: 'Руководитель' },
  { id: 'buddy', label: 'Buddy' },
  { id: 'hr', label: 'HR' }
]);

const assignForm = reactive({
  scenario_id: '',
  employee_id: ''
});
const assigning = ref(false);
const assignError = ref('');
const assignOk = ref(false);

const editorOpen = ref(false);
const editorMode = ref<'create' | 'edit'>('create');
const editorSaving = ref(false);
const editorError = ref('');
const editorForm = reactive({
  id: '',
  title: '',
  short_title: '',
  description: '',
  audience: '',
  extra_steps_by_phase: emptyExtras()
});

const employeeOptions = computed(() =>
  [...employees.value]
    .filter((e) => e.name.trim())
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
);

const scenarioTitle = (id: string) =>
  scenarios.value.find((s) => s.id === id)?.title ?? id;

const countExtraSteps = (scenario: Scenario) =>
  Object.values(scenario.extra_steps_by_phase || {}).reduce(
    (sum, steps) => sum + (steps?.length || 0),
    0
  );

const loadScenarios = async () => {
  const data = await $fetch<{
    scenarios: Scenario[];
    assignments: Assignment[];
    phase_options?: PhaseOption[];
    owner_options?: OwnerOption[];
  }>('/api/adaptation/scenarios');
  scenarios.value = data.scenarios;
  assignments.value = data.assignments;
  if (data.phase_options?.length) phaseOptions.value = data.phase_options;
  if (data.owner_options?.length) ownerOptions.value = data.owner_options;
  if (!assignForm.scenario_id && scenarios.value[0]) {
    assignForm.scenario_id = scenarios.value[0].id;
  }
};

const fillEditor = (scenario?: Scenario) => {
  editorForm.id = scenario?.id || '';
  editorForm.title = scenario?.title || '';
  editorForm.short_title = scenario?.short_title || '';
  editorForm.description = scenario?.description || '';
  editorForm.audience = scenario?.audience || '';
  const extras = emptyExtras();
  const src = scenario?.extra_steps_by_phase || {};
  for (const key of Object.keys(extras) as (keyof typeof extras)[]) {
    extras[key] = (src[key] || []).map((step) => ({
      id: step.id,
      title: step.title,
      due_day: step.due_day,
      owner: step.owner
    }));
  }
  editorForm.extra_steps_by_phase = extras;
};

const openCreate = () => {
  editorMode.value = 'create';
  editorError.value = '';
  fillEditor();
  editorOpen.value = true;
};

const openEdit = (scenario: Scenario) => {
  editorMode.value = 'edit';
  editorError.value = '';
  fillEditor(scenario);
  editorOpen.value = true;
};

const closeEditor = () => {
  editorOpen.value = false;
  editorError.value = '';
};

const addStep = (phaseId: string) => {
  const list = editorForm.extra_steps_by_phase[phaseId] || [];
  list.push({
    title: '',
    due_day: phaseId === 'month_1' ? 21 : phaseId === 'week_1' ? 7 : 1,
    owner: 'employee'
  });
  editorForm.extra_steps_by_phase[phaseId] = list;
};

const removeStep = (phaseId: string, index: number) => {
  const list = editorForm.extra_steps_by_phase[phaseId] || [];
  list.splice(index, 1);
  editorForm.extra_steps_by_phase[phaseId] = list;
};

const saveEditor = async () => {
  editorError.value = '';
  editorSaving.value = true;
  try {
    const body = {
      id: editorForm.id || undefined,
      title: editorForm.title,
      short_title: editorForm.short_title,
      description: editorForm.description,
      audience: editorForm.audience,
      extra_steps_by_phase: editorForm.extra_steps_by_phase
    };
    if (editorMode.value === 'create') {
      await $fetch('/api/adaptation/scenarios', { method: 'POST', body });
    } else {
      await $fetch(`/api/adaptation/scenarios/${editorForm.id}`, {
        method: 'PUT',
        body
      });
    }
    await loadScenarios();
    closeEditor();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string };
    editorError.value = err.data?.statusMessage ?? err.message ?? 'Не удалось сохранить';
  } finally {
    editorSaving.value = false;
  }
};

const confirmDelete = async (scenario: Scenario) => {
  if (scenarios.value.length <= 1) return;
  const ok = window.confirm(
    `Удалить сценарий «${scenario.title}»? Назначения на него будут сняты.`
  );
  if (!ok) return;
  try {
    await $fetch(`/api/adaptation/scenarios/${scenario.id}`, { method: 'DELETE' });
    if (assignForm.scenario_id === scenario.id) assignForm.scenario_id = '';
    await loadScenarios();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string };
    assignError.value = err.data?.statusMessage ?? err.message ?? 'Не удалось удалить';
  }
};

const submitAssign = async () => {
  assignError.value = '';
  assignOk.value = false;
  assigning.value = true;
  try {
    await $fetch('/api/adaptation/assign', {
      method: 'POST',
      body: {
        employee_id: Number(assignForm.employee_id),
        scenario_id: assignForm.scenario_id
      }
    });
    assignOk.value = true;
    await loadScenarios();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string };
    assignError.value = err.data?.statusMessage ?? err.message ?? 'Не удалось назначить';
  } finally {
    assigning.value = false;
  }
};

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

onMounted(() => {
  reload();
  hydrateEmployees().catch(() => {});
  loadScenarios().catch(() => {});
});
</script>
