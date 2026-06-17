<template>
  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h2 class="section-title">График отпусков (HR)</h2>
        <p class="muted">Полный календарь команды и очередь согласования. Данные сотрудников — в разделе «Сотрудники».</p>
      </div>
      <select v-model.number="viewYear" class="table-input year-select">
        <option :value="2025">2025</option>
        <option :value="2026">2026</option>
        <option :value="2027">2027</option>
      </select>
    </div>
  </section>

  <section class="card section-card">
    <VacationTeamCalendar
      :departments="departmentsGrouped"
      :year="viewYear"
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
              <span v-if="overlapDetails(req).length" class="vac-overlap-badge-wrap">
                <span class="vac-overlap-badge" tabindex="0">
                  <span class="vac-overlap-badge__dot" aria-hidden="true" />
                  Есть пересечение
                </span>
                <div class="vac-overlap-popover" role="tooltip">
                  <p class="vac-overlap-popover__title">Пересечения отпусков</p>
                  <div
                    v-for="(item, index) in overlapDetails(req)"
                    :key="`${item.employee}-${item.vacationStart}-${index}`"
                    class="vac-overlap-popover__item"
                  >
                    <strong>{{ item.employee }}</strong>
                    <dl class="vac-overlap-popover__meta">
                      <div>
                        <dt>Отпуск</dt>
                        <dd>{{ formatRange(item.vacationStart, item.vacationEnd) }}</dd>
                      </div>
                      <div>
                        <dt>Пересечение</dt>
                        <dd>{{ formatRange(item.overlapStart, item.overlapEnd) }}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </span>
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
import type { VacationRequest } from '~/composables/useVacations';

const { departmentsGrouped, hydrate: hydrateEmployees } = useEmployees();
const { canSeeAllVacationApprovals } = usePermissions();
const {
  viewYear,
  yearRequests,
  pendingRequestsForApprover,
  getMonthEntries,
  setRequestStatus,
  hydrate: hydrateVacations
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

onMounted(() => {
  hydrateEmployees();
  hydrateVacations();
});
</script>
