<template>
  <aside
    class="vac-manager-aside-panel"
    :class="{ 'vac-manager-aside-panel--employee-view': modelValue === 'employee' }"
  >
    <VacationUiModeToggle
      :model-value="modelValue"
      :team-mode-label="props.managerModeLabel"
      @update:model-value="setMode"
    />

    <div
      v-if="showHrTab && modelValue === 'manager'"
      class="role-switch role-switch--aside"
      role="group"
      aria-label="Раздел платформы"
    >
      <button type="button" class="role-btn active">Руководитель</button>
      <button type="button" class="role-btn" @click="setMode('employee')">Сотрудник</button>
      <NuxtLink to="/admin/vacations" class="role-btn role-btn--link">HR</NuxtLink>
    </div>

    <template v-if="modelValue === 'manager'">
      <div class="vac-aside-stat-card">
        <div class="vac-aside-stat-label">Сегодня</div>
        <div class="vac-aside-stat-value">{{ todayLabel }}</div>
      </div>

      <div class="vac-aside-stat-card">
        <div class="vac-aside-stat-label">Сейчас в отпуске</div>
        <div class="vac-aside-stat-value">{{ onVacationNow }} из {{ teamTotal }}</div>
      </div>

      <ManagerVacationTrainingPrompt />

      <div v-if="managerReservationGroup" class="vac-aside-stat-card" data-tour="vac-reservation-cap">
        <div class="vac-aside-stat-label">Лимит броней на месяц</div>
        <p class="vac-cap-setting__hint soft">{{ managerReservationGroup.label }}</p>
        <div class="vac-cap-setting">
          <input
            v-model.number="capDraft"
            type="number"
            min="1"
            max="99"
            class="org-input vac-cap-setting__input"
            aria-label="Максимум броней на месяц"
          />
          <button
            type="button"
            class="vac-emp-btn vac-emp-btn--sm"
            :disabled="capSaving || capDraft === currentGroupCap"
            @click="saveGroupCap"
          >
            {{ capSaving ? 'Сохранение…' : 'Сохранить' }}
          </button>
        </div>
        <p v-if="capSaveError" class="vac-cap-setting__error">{{ capSaveError }}</p>
      </div>

      <div class="vac-aside-stat-card">
        <div class="vac-aside-stat-label">Заявки</div>
        <ul class="vac-aside-requests list-reset">
          <li class="vac-aside-stat-line">
            <span class="vac-aside-stat-line-label">Всего заявок:</span>
            <span class="vac-aside-stat-line-dots" aria-hidden="true" />
            <span class="vac-aside-stat-line-value">{{ stats.total }}</span>
          </li>
          <li class="vac-aside-stat-line">
            <span class="vac-aside-stat-line-label">На согласовании:</span>
            <span class="vac-aside-stat-line-dots" aria-hidden="true" />
            <span class="vac-aside-stat-line-value">{{ stats.pending }}</span>
          </li>
          <li class="vac-aside-stat-line">
            <span class="vac-aside-stat-line-label">Одобрено:</span>
            <span class="vac-aside-stat-line-dots" aria-hidden="true" />
            <span class="vac-aside-stat-line-value">{{ stats.approved }}</span>
          </li>
          <li class="vac-aside-stat-line">
            <span class="vac-aside-stat-line-label">Отклонено:</span>
            <span class="vac-aside-stat-line-dots" aria-hidden="true" />
            <span class="vac-aside-stat-line-value">{{ stats.rejected }}</span>
          </li>
        </ul>
      </div>
    </template>

    <template v-else>
      <EmployeeVacationAside :view-year="viewYear" />
    </template>
  </aside>
</template>

<script setup lang="ts">
import type { VacationUiMode } from '~/components/VacationUiModeToggle.vue';
import {
  resolveReservationCapGroupIdForManager,
  resolveReservationCapGroupMeta
} from '~/utils/vacationDepartmentGroups';
import { getDepartmentReservationMonthlyCap } from '~/utils/vacationReservationCaps';

export type ManagerVacationUiMode = VacationUiMode;

export type VacationRequestStats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

const props = withDefaults(
  defineProps<{
    modelValue: ManagerVacationUiMode;
    viewYear: number;
    todayLabel: string;
    onVacationNow: number;
    teamTotal: number;
    stats: VacationRequestStats;
    showHrTab?: boolean;
    /** Подпись режима «команда/отдел» (по умолчанию «Руководитель»). */
    managerModeLabel?: string;
  }>(),
  { managerModeLabel: 'Руководитель' }
);

const emit = defineEmits<{
  'update:modelValue': [value: ManagerVacationUiMode];
}>();

const setMode = (mode: ManagerVacationUiMode) => {
  emit('update:modelValue', mode);
};

const { user } = useAuth();
const { findByUserForAuth, directReports, findByName, employeesInDepartment } = useEmployees();
const { state, updateReservationMonthlyCap } = useVacations();

const managerEmployee = computed(() => findByUserForAuth(user.value));

const managerReservationGroupId = computed(() => {
  const name = managerEmployee.value?.name?.trim();
  const department = managerEmployee.value?.department?.trim();
  if (!name || !department) return null;
  return resolveReservationCapGroupIdForManager(
    name,
    { directReports, findByName, employeesInDepartment },
    department
  );
});

const managerReservationGroup = computed(() => {
  const id = managerReservationGroupId.value;
  if (!id) return null;
  return resolveReservationCapGroupMeta(id) ?? { id, label: id };
});

const currentGroupCap = computed(() => {
  const id = managerReservationGroupId.value;
  if (!id) return 5;
  return getDepartmentReservationMonthlyCap(id, state.value.reservationMonthlyCapsByGroup);
});

const capDraft = ref(5);
const capSaving = ref(false);
const capSaveError = ref('');

watch(
  currentGroupCap,
  (value) => {
    capDraft.value = value;
  },
  { immediate: true }
);

const saveGroupCap = async () => {
  const id = managerReservationGroupId.value;
  if (!id) return;
  capSaveError.value = '';
  capSaving.value = true;
  const ok = await updateReservationMonthlyCap(id, capDraft.value);
  capSaving.value = false;
  if (!ok) {
    capSaveError.value = 'Не удалось сохранить лимит';
  }
};
</script>
