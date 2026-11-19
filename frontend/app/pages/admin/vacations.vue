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
              <button
                v-if="canEdit(req)"
                class="vac-admin-edit-pencil"
                type="button"
                aria-label="Изменить даты"
                title="Изменить даты"
                @click="openEdit(req)"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                <path
                  d="M14.5 5.5 18.5 9.5M4 20l.8-3.7L16.2 5 20 8.8 8.7 20.1 5 20.9 4 20Z"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linejoin="round"
                />
              </svg>
              </button>
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

    <section v-if="canEditAny" class="card section-card vac-approval-panel vac-admin-all">
      <header class="vac-approval-panel__head">
        <h3 class="section-title vac-approval-panel__title">Отпуска {{ viewYear }}</h3>
        <input
          v-model="allQuery"
          type="search"
          class="vac-emp-input vac-admin-all__search"
          placeholder="Сотрудник"
          aria-label="Поиск по сотруднику"
        />
      </header>

      <p v-if="filteredAll.length === 0" class="vac-admin-all__empty">Нет заявок</p>
      <ul v-else class="list-reset vac-admin-all__list">
        <li v-for="req in visibleAll" :key="req.id" class="vac-admin-all__row">
          <span class="vac-admin-all__name">{{ req.employee }}</span>
          <span class="vac-admin-all__dates">{{ formatRange(req.start, req.end) }}</span>
          <span
            class="vac-admin-all__status"
            :class="req.status === 'approved' ? 'is-approved' : 'is-pending'"
          >{{ approvalStepLabel(req) }}</span>
          <span
            class="vac-admin-all__edited"
            :title="lastEditSummary(req)"
          >{{ lastEditSummary(req) ? 'изменено' : '' }}</span>
          <button
            class="vac-admin-edit-pencil"
            type="button"
            aria-label="Изменить отпуск"
            title="Изменить"
            @click="openEdit(req)"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                <path
                  d="M14.5 5.5 18.5 9.5M4 20l.8-3.7L16.2 5 20 8.8 8.7 20.1 5 20.9 4 20Z"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linejoin="round"
                />
              </svg>
          </button>
        </li>
      </ul>
      <button
        v-if="filteredAll.length > visibleAll.length"
        type="button"
        class="button ghost vac-admin-all__more"
        @click="allLimit += 50"
      >
        Показать ещё ({{ filteredAll.length - visibleAll.length }})
      </button>
    </section>

    <AdminEditVacationDialog v-model:open="editOpen" :request="editRequest" />
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
import { canAdminEditVacationRequest, isVacationAdminEditorRole } from '~/utils/vacationAdminEdit';
import { employeeNamesMatch } from '~/utils/employeeName';

const { departmentsGrouped, employees, findByName, reloadFromServer: reloadEmployees } = useEmployees();
const { canSeeAllVacationApprovals, role } = usePermissions();
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

/** Правка дат/комментария HR/админом без смены статуса (сервер проверяет права сам). */
const canEditAny = computed(() => isVacationAdminEditorRole(role.value));
const canEdit = (req: VacationRequest) => canAdminEditVacationRequest(role.value, req);
const editOpen = ref(false);
const editRequestId = ref<number | null>(null);
/** Берём заявку из state по id: после сохранения диалог видит свежие данные. */
const editRequest = computed(() =>
  editRequestId.value === null
    ? null
    : Object.values(state.value.requestsByYear)
        .flat()
        .find((r) => r.id === editRequestId.value) ?? null
);
const openEdit = (req: VacationRequest) => {
  editRequestId.value = req.id;
  editOpen.value = true;
};

const allQuery = ref('');
const allLimit = ref(50);
watch(allQuery, () => {
  allLimit.value = 50;
});
const filteredAll = computed(() => {
  const q = allQuery.value.trim().toLowerCase();
  return yearRequests.value
    .filter((r) => canEdit(r))
    .filter(
      (r) => !q || r.employee.toLowerCase().includes(q) || employeeNamesMatch(r.employee, allQuery.value)
    )
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start) || a.employee.localeCompare(b.employee, 'ru'));
});
const visibleAll = computed(() => filteredAll.value.slice(0, allLimit.value));
const lastEditSummary = (req: VacationRequest) => {
  const edits = req.admin_edits;
  return edits?.length ? edits[edits.length - 1]!.summary : '';
};
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

<style scoped>
.vac-admin-edit-pencil {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex: 0 0 auto;
}

.vac-admin-edit-pencil:hover {
  color: var(--text);
  border-color: var(--border);
  background: var(--bg-soft);
}

.vac-admin-edit-pencil:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

.vac-admin-all__search {
  width: min(240px, 50%);
  padding: 6px 10px;
  font-size: 0.85rem;
}

.vac-admin-all__empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.vac-admin-all__list {
  border: 1px solid var(--border-brutal);
  border-radius: var(--brutal-list-radius);
  max-height: 420px;
  overflow-y: auto;
}

.vac-admin-all__row {
  display: grid;
  grid-template-columns: minmax(140px, 1.4fr) minmax(170px, 1fr) minmax(120px, 1fr) 64px 30px;
  align-items: center;
  gap: 12px;
  padding: 6px 10px 6px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 0.86rem;
}

.vac-admin-all__row:last-child {
  border-bottom: none;
}

.vac-admin-all__name {
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vac-admin-all__dates {
  color: var(--text-muted);
  white-space: nowrap;
}

.vac-admin-all__status {
  font-size: 0.78rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vac-admin-all__status.is-approved {
  color: #166534;
}

.vac-admin-all__status.is-pending {
  color: #92400e;
}

.vac-admin-all__edited {
  font-size: 0.74rem;
  color: var(--text-muted);
  cursor: help;
}

.vac-admin-all__more {
  margin-top: 10px;
}

@media (max-width: 720px) {
  .vac-admin-all__row {
    grid-template-columns: 1fr auto 30px;
  }

  .vac-admin-all__status,
  .vac-admin-all__edited {
    display: none;
  }
}
</style>
