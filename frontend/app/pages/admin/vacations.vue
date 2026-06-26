<template>
  <section class="card section-card">
    <VacationTeamCalendar
      :departments="departmentsGrouped"
      :requests="yearRequests"
      :get-month-entries="getMonthEntries"
    />
  </section>

  <section class="card section-card vac-approval-panel">
    <header class="vac-approval-panel__head">
      <h3 class="section-title vac-approval-panel__title">Заявки на согласование</h3>
      <span v-if="approvalQueue.length" class="vac-approval-panel__count">
        {{ approvalQueue.length }}
      </span>
    </header>

    <div v-if="approvalQueue.length === 0" class="vac-approval-empty">
      <p>Очередь пуста за {{ viewYear }} год</p>
    </div>

    <ul v-else class="list-reset vac-approval-list">
      <li v-for="req in approvalQueue" :key="req.id" class="vac-approval-item">
        <div class="vac-approval-item__accent" aria-hidden="true" />
        <div class="vac-approval-item__body">
          <div class="vac-approval-item__lead">
            <span class="vac-approval-item__avatar">{{ employeeInitials(req.employee) }}</span>
            <div class="vac-approval-item__info">
              <strong class="vac-approval-item__name">{{ req.employee }}</strong>
              <span class="vac-approval-item__dates">{{ formatRange(req.start, req.end) }}</span>
              <VacOverlapPopover
                v-if="overlapDetails(req).length"
                :items="overlapDetails(req)"
                :format-range="formatRange"
              />
              <VacAdvancePopover
                v-if="advanceAssessment(req).status === 'advance'"
                :assessment="advanceAssessment(req)"
              />
            </div>
          </div>
          <div class="vac-approval-item__actions">
            <button class="button vac-btn-approve" type="button" @click="setRequestStatus(req.id, 'approved')">
              Согласовать
            </button>
            <button class="button vac-btn-reject" type="button" @click="setRequestStatus(req.id, 'rejected')">
              Отклонить
            </button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { findVacationOverlapDetails } from '~/utils/vacationCalendar';
import { assessVacationBalance } from '~/utils/vacationBalance';
import type { VacationRequest } from '~/composables/useVacations';

const { departmentsGrouped, findByName, reloadFromServer: reloadEmployees } = useEmployees();
const { canSeeAllVacationApprovals } = usePermissions();
const {
  viewYear,
  yearRequests,
  pendingRequestsForApprover,
  getMonthEntries,
  setRequestStatus,
  reloadFromServer: reloadVacations,
  state
} = useVacations();

const approvalQueue = computed(() => pendingRequestsForApprover(null, canSeeAllVacationApprovals.value));

const formatRange = (start: string, end: string) => {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(start)} — ${fmt(end)}`;
};

const employeeInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
};

const overlapDetails = (req: VacationRequest) => findVacationOverlapDetails(req, yearRequests.value);

const advanceAssessment = (req: VacationRequest) =>
  assessVacationBalance(
    req.employee,
    findByName(req.employee)?.hired_at,
    req.start,
    req.end,
    yearRequests.value,
    state.value.primaryYear,
    req.id,
    findByName(req.employee)?.vacation_opening_balance
  );

onMounted(() => {
  reloadEmployees();
  reloadVacations();
});
</script>
