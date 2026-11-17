<template>
  <div class="vac-admin-vacations">
    <section class="vac-admin-vacations__calendar">
      <VacationTeamCalendar
        :departments="departmentsGrouped"
        :requests="yearRequests"
        :reservations="yearReservations"
        :get-month-entries="getMonthEntries"
        show-load-strip
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
        <p>Очередь пуста</p>
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
                <span v-if="req.status === 'pending'" class="vac-approval-item__step soft">
                  {{ approvalStepLabel(req) }}
                </span>
                <VacationOverlapBadge
                  v-if="overlapsFor(req).length"
                  :count="countOverlapPeople(overlapsFor(req))"
                  :open="isOverlapOpen(req.id)"
                  @toggle="toggleOverlap(req.id)"
                />
                <VacAdvancePopover
                  v-if="advanceAssessment(req).status === 'advance'"
                  :assessment="advanceAssessment(req)"
                />
              </div>
            </div>
            <div class="vac-approval-item__actions">
              <button class="button vac-btn-approve" type="button" @click="approve(req.id)">
                Согласовать
              </button>
              <button class="button vac-btn-reject" type="button" @click="reject(req.id)">
                Отклонить
              </button>
            </div>
            <VacationOverlapTimeline
              v-if="overlapsFor(req).length && isOverlapOpen(req.id)"
              :request="req"
              :entries="overlapsFor(req)"
            />
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  countOverlapPeople,
  findRequestOverlaps,
  resolveOverlapScope,
  type VacationOverlapEntry
} from '~/utils/vacationOverlaps';
import { assessVacationBalance } from '~/utils/vacationBalance';
import { requestsAroundYear } from '~/utils/vacationBookingYears';
import type { VacationRequest } from '~/composables/useVacations';

const { departmentsGrouped, employees, findByName, reloadFromServer: reloadEmployees } = useEmployees();
const { canSeeAllVacationApprovals } = usePermissions();
const {
  viewYear,
  yearRequests,
  yearReservations,
  pendingRequestsForApprover,
  getMonthEntries,
  approveRequest,
  setRequestStatus,
  requestStatusLabel,
  reloadFromServer: reloadVacations,
  state
} = useVacations();

const approvalQueue = computed(() =>
  pendingRequestsForApprover(null, canSeeAllVacationApprovals.value)
);

const approvalStepLabel = (req: VacationRequest) =>
  requestStatusLabel(req, findByName(req.employee));

const approve = (id: number) => approveRequest(id, null, { elevated: true });
const reject = (id: number) => setRequestStatus(id, 'rejected');

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

/** Пересечения для админа: только отдел заявителя (approved + pending). */
const overlapsByRequestId = computed(() => {
  const map = new Map<number, VacationOverlapEntry[]>();
  for (const req of approvalQueue.value) {
    const scope = resolveOverlapScope({
      mode: 'requester-department',
      requesterName: req.employee,
      employees: employees.value
    });
    const pool = requestsAroundYear(state.value.requestsByYear, Number(req.start.slice(0, 4)));
    map.set(req.id, findRequestOverlaps(req, pool, scope));
  }
  return map;
});

const overlapsFor = (req: VacationRequest) => overlapsByRequestId.value.get(req.id) ?? [];

/** Таймлайн пересечений скрыт по умолчанию (меньше шума); раскрывается кликом по плашке. */
const expandedOverlapIds = ref(new Set<number>());
const isOverlapOpen = (id: number) => expandedOverlapIds.value.has(id);
const toggleOverlap = (id: number) => {
  const next = new Set(expandedOverlapIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedOverlapIds.value = next;
};

/** Все заявки всех лет: остаток для следующего года считается через переходящий остаток. */
const allRealRequests = computed(() => Object.values(state.value.requestsByYear).flat());

const advanceAssessment = (req: VacationRequest) =>
  assessVacationBalance(
    req.employee,
    findByName(req.employee)?.hired_at,
    req.start,
    req.end,
    allRealRequests.value,
    state.value.primaryYear,
    req.id,
    findByName(req.employee)?.vacation_opening_balance
  );

onMounted(() => {
  reloadEmployees();
  reloadVacations();
});
</script>
