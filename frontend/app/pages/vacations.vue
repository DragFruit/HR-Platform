<template>
  <div v-if="!authReady" class="auth-loading">Загрузка...</div>

  <template v-else>
    <div v-if="showEmployeePanel" class="vacations-employee-shell">
      <EmployeeVacationPanel :view-year="viewYear" @update:view-year="onViewYearChange" />
    </div>

    <template v-else>
      <div
        class="vac-manager-layout"
        :class="{
          'vac-manager-layout--with-aside': showManagerShell,
          'vac-manager-layout--employee': showManagerShell && managerUiMode === 'employee'
        }"
      >
        <div class="vac-manager-main">
          <EmployeeVacationPanel
            v-if="showManagerShell && managerUiMode === 'employee'"
            embedded
            :view-year="viewYear"
            @update:view-year="onViewYearChange"
          />

          <template v-else>
            <div class="vac-manager-toolbar">
              <div class="filters">
                <button
                  v-for="tab in visibleTabs"
                  :key="tab.id"
                  type="button"
                  class="filter-btn"
                  :class="{ active: activeTab === tab.id }"
                  @click="activeTab = tab.id"
                >
                  {{ tab.label }}
                  <span v-if="tab.id === 'approval' && approvalQueue.length" class="pill mini-pill">
                    {{ approvalQueue.length }}
                  </span>
                </button>
              </div>
            </div>

            <VacationTeamCalendar
              v-if="activeTab === 'calendar'"
              :departments="calendarDepartments"
              :year="viewYear"
              :requests="yearRequests"
              :get-month-entries="getMonthEntries"
            />

            <section v-else class="card section-card">
              <h3 class="section-title">Очередь согласования</h3>
              <p v-if="isManager && currentEmployee" class="muted">
                Заявки подчинённых, у которых руководитель —
                <strong>{{ currentEmployee.name }}</strong>.
              </p>
              <p v-else-if="canSeeAllVacationApprovals" class="muted">Все заявки на согласование.</p>

              <div v-if="approvalQueue.length === 0" class="state-box compact-state">
                <p class="muted">Нет заявок на согласование за {{ viewYear }} год.</p>
              </div>

              <ul v-else class="list-reset vacation-request-list">
                <li v-for="req in approvalQueue" :key="req.id" class="task-item">
                  <div class="row">
                    <div>
                      <strong>{{ req.employee }}</strong>
                      <p class="muted">{{ formatRange(req.start, req.end) }}</p>
                    </div>
                    <div class="row">
                      <button class="button primary" type="button" @click="approve(req.id)">Согласовать</button>
                      <button class="button ghost" type="button" @click="reject(req.id)">Отклонить</button>
                    </div>
                  </div>
                  <p class="soft">{{ req.comment }}</p>
                </li>
              </ul>
            </section>
          </template>
        </div>

        <ManagerVacationAside
          v-if="showManagerShell"
          v-model="managerUiMode"
          :view-year="viewYear"
          :today-label="todayLabel"
          :on-vacation-now="onVacationNow"
          :team-total="teamTotal"
          :stats="teamRequestStats"
          :show-hr-tab="isHr"
        />
      </div>
    </template>
  </template>
</template>

<script setup lang="ts">
const { user, authReady } = useAuth();
const { isManager, isHr, canApproveVacations, canSeeAllVacationApprovals } = usePermissions();
const { isAdmin: isAdminShell } = usePlatformContext();
const { departmentsGrouped, directReports, findByUserForAuth, hydrate: hydrateEmployees } =
  useEmployees();
const {
  viewYear,
  yearRequests,
  pendingRequestsForApprover,
  getMonthEntries,
  setRequestStatus,
  hydrate: hydrateVacations
} = useVacations();

const activeTab = ref<'calendar' | 'approval'>('calendar');
const managerUiMode = ref<'manager' | 'employee'>('manager');

const showEmployeePanel = computed(() => {
  if (!user.value) return false;
  if (user.value.role === 'employee') return true;
  // Админ в режиме «Сотрудник» в оболочке — тот же экран отпусков
  if (user.value.role === 'admin' && !isAdminShell.value) return true;
  return false;
});

const showManagerShell = computed(() => {
  if (!user.value) return false;
  return user.value.role === 'manager' || user.value.role === 'hr';
});

const visibleTabs = computed(() => {
  const tabs = [{ id: 'calendar' as const, label: 'Календарь' }];
  if (canApproveVacations.value) tabs.push({ id: 'approval' as const, label: 'Согласование' });
  return tabs;
});

const currentEmployee = computed(() => findByUserForAuth(user.value));

const groupByDepartment = (list: ReturnType<typeof directReports>) => {
  const map = new Map<string, typeof list>();
  list.forEach((emp) => {
    const bucket = map.get(emp.department) ?? [];
    bucket.push(emp);
    map.set(emp.department, bucket);
  });
  return [...map.entries()].map(([name, employees]) => ({
    name,
    employees: employees.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }));
};

/** Руководитель видит только подчинённых; HR/админ — всю команду */
const calendarDepartments = computed(() => {
  if (isManager.value && currentEmployee.value && !canSeeAllVacationApprovals.value) {
    return groupByDepartment(directReports(currentEmployee.value.name));
  }
  return departmentsGrouped.value;
});

const approvalQueue = computed(() =>
  pendingRequestsForApprover(currentEmployee.value?.name ?? null, canSeeAllVacationApprovals.value)
);

const teamMembers = computed(() => {
  if (isManager.value && currentEmployee.value && !canSeeAllVacationApprovals.value) {
    return directReports(currentEmployee.value.name);
  }
  return departmentsGrouped.value.flatMap((dep) => dep.employees);
});

const teamEmployeeNames = computed(() => teamMembers.value.map((emp) => emp.name));

const teamRequests = computed(() =>
  yearRequests.value.filter((req) => teamEmployeeNames.value.includes(req.employee))
);

const teamRequestStats = computed(() => ({
  total: teamRequests.value.length,
  pending: teamRequests.value.filter((r) => r.status === 'pending').length,
  approved: teamRequests.value.filter((r) => r.status === 'approved').length,
  rejected: teamRequests.value.filter((r) => r.status === 'rejected').length
}));

const teamTotal = computed(() => teamMembers.value.length);

const onVacationNow = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const active = new Set<string>();
  teamRequests.value.forEach((req) => {
    if (req.status !== 'approved') return;
    const start = new Date(`${req.start}T00:00:00`);
    const end = new Date(`${req.end}T00:00:00`);
    if (today >= start && today <= end) active.add(req.employee);
  });
  return active.size;
});

const todayLabel = computed(() =>
  new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
);

const formatRange = (start: string, end: string) => {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(start)} — ${fmt(end)}`;
};

const approve = (id: number) => setRequestStatus(id, 'approved');
const reject = (id: number) => setRequestStatus(id, 'rejected');

const onViewYearChange = (year: number) => {
  viewYear.value = year;
};

onMounted(() => {
  hydrateEmployees();
  hydrateVacations();
});
</script>
