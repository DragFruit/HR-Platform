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

  <section class="card section-card">
    <h3 class="section-title">Заявки на согласование</h3>
    <ul v-if="approvalQueue.length" class="list-reset vacation-request-list">
      <li v-for="req in approvalQueue" :key="req.id" class="task-item">
        <div class="row">
          <div>
            <strong>{{ req.employee }}</strong>
            <p class="muted">{{ formatRange(req.start, req.end) }}</p>
          </div>
          <div class="row">
            <button class="button primary" type="button" @click="setRequestStatus(req.id, 'approved')">Согласовать</button>
            <button class="button ghost" type="button" @click="setRequestStatus(req.id, 'rejected')">Отклонить</button>
          </div>
        </div>
      </li>
    </ul>
    <p v-else class="muted">Очередь пуста.</p>
  </section>
</template>

<script setup lang="ts">
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

onMounted(() => {
  hydrateEmployees();
  hydrateVacations();
});
</script>
