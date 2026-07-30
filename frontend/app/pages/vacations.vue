<template>
  <div v-if="!authReady" class="auth-loading">Загрузка...</div>

  <template v-else>
    <VacationTrainingOverlay v-if="vacationTrainingEnabled" />
    <ManagerVacationTrainingOverlay v-if="vacationTrainingEnabled" />

    <div
      v-if="showFullEmployeeVacations || showManagerAsEmployee"
      class="vacations-employee-shell"
    >
      <EmployeeVacationPanel
        :view-year="viewYear"
        :ui-mode="showManagerShell ? managerUiMode : undefined"
        team-mode-label="Руководитель"
        @update:view-year="onViewYearChange"
        @update:ui-mode="managerUiMode = $event"
      />
    </div>

    <template v-else>
      <div
        class="vac-manager-layout"
        :class="{
          'vac-manager-layout--with-aside': showManagerShell
        }"
      >
        <div class="vac-manager-main">
            <div class="vac-manager-toolbar">
              <div class="filters">
                <button
                  v-for="tab in visibleTabs"
                  :key="tab.id"
                  type="button"
                  class="filter-btn"
                  :data-tour="tab.id === 'approval' ? 'vac-approval-tab' : null"
                  :class="{ active: activeTab === tab.id }"
                  @click="setActiveTab(tab.id)"
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
              :requests="yearRequests"
              :reservations="yearReservations"
              :get-month-entries="getMonthEntries"
              :show-department-daily-counts="showDepartmentDailyCounts"
            />

            <section v-else class="card section-card vac-approval-panel">
              <header class="vac-approval-panel__head">
                <h3 class="section-title vac-approval-panel__title">Очередь согласования</h3>
                <span v-if="approvalQueue.length" class="vac-approval-panel__count">
                  {{ approvalQueue.length }}
                </span>
              </header>

              <div v-if="approvalPanelEntries.length === 0" class="vac-approval-empty">
                <p>Нет заявок на согласование за {{ viewYear }} год</p>
              </div>

              <ul v-else class="list-reset vac-approval-list">
                <li
                  v-for="entry in approvalPanelEntries"
                  :key="entry.request.id"
                  class="vac-approval-item"
                  :class="{ 'vac-approval-item--handed-off': entry.handedOff }"
                >
                  <div class="vac-approval-item__accent" aria-hidden="true" />
                  <div class="vac-approval-item__body">
                    <div class="vac-approval-item__lead">
                      <span class="vac-approval-item__avatar">{{ employeeInitials(entry.request.employee) }}</span>
                      <div class="vac-approval-item__info">
                        <strong class="vac-approval-item__name">{{ entry.request.employee }}</strong>
                        <span class="vac-approval-item__dates">{{ formatRange(entry.request.start, entry.request.end) }}</span>
                        <span
                          v-if="entry.request.status === 'pending' && !entry.handedOff"
                          class="vac-approval-item__step soft"
                        >
                          {{ approvalStepLabel(entry.request) }}
                        </span>
                        <VacOverlapPopover
                          v-if="overlapDetails(entry.request).length"
                          :items="overlapDetails(entry.request)"
                          :format-range="formatRange"
                        />
                        <VacAdvancePopover
                          v-if="advanceAssessment(entry.request).status === 'advance'"
                          :assessment="advanceAssessment(entry.request)"
                        />
                      </div>
                    </div>
                    <div class="vac-approval-item__actions">
                      <span v-if="entry.handedOff" class="vac-approval-handoff-badge">
                        {{ handoffStatusLabel(entry.request) }}
                      </span>
                      <template v-else>
                        <button class="button vac-btn-approve" type="button" @click="approve(entry.request.id)">
                          Согласовать
                        </button>
                        <button class="button vac-btn-reject" type="button" @click="reject(entry.request.id)">
                          Отклонить
                        </button>
                      </template>
                    </div>
                  </div>
                </li>
              </ul>
            </section>
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
          :manager-mode-label="'Руководитель'"
        />
      </div>
    </template>
  </template>
</template>

<script setup lang="ts">
import type { VacationRequest } from '~/composables/useVacations';
import { vacationPendingStatusLabel } from '~/utils/vacationApproval';
import {
  isGroupedVacationDepartment,
  isVacationDepartmentDirector,
  isVacationGroupLead,
  resolveManagerCalendarDepartments
} from '~/utils/vacationDepartmentGroups';
import { findVacationOverlapDetails } from '~/utils/vacationCalendar';
import { assessVacationBalance } from '~/utils/vacationBalance';
const { user, authReady } = useAuth();
const runtimeConfig = useRuntimeConfig();
const vacationTrainingEnabled = computed(() => runtimeConfig.public.vacationTrainingEnabled === true);
const { isManager, isHr, canApproveVacations, canSeeAllVacationApprovals } = usePermissions();
const { notifyApprovalTabOpened, currentStep, isActive: isManagerTrainingActive } = useManagerVacationTraining();
const { isAdmin: isAdminShell } = usePlatformContext();
const { departmentsGrouped, allReportsForAuthUser, managerProfileName, findByName, findByUserForAuth, employees, directReports, reloadFromServer: reloadEmployees } =
  useEmployees();
const {
  viewYear,
  yearRequests,
  yearReservations,
  pendingRequestsForApprover,
  handedOffRequestsForApprover,
  getMonthEntries,
  approveRequest,
  setRequestStatus,
  requestStatusLabel,
  reloadFromServer: reloadVacations,
  state
} = useVacations();

const activeTab = ref<'calendar' | 'approval'>('calendar');
const managerUiMode = ref<'manager' | 'employee'>('manager');
const route = useRoute();

const parseVacationTab = (raw: unknown): 'calendar' | 'approval' | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'approval' || value === 'calendar') return value;
  return null;
};

const applyTabFromRoute = () => {
  const tab = parseVacationTab(route.query.tab);
  if (!tab) return;
  if (tab === 'approval') {
    if (!canApproveVacations.value) return;
    managerUiMode.value = 'manager';
  }
  activeTab.value = tab;
};

const showFullEmployeeVacations = computed(() => {
  if (!user.value) return false;
  if (user.value.role === 'employee') return true;
  if (user.value.role === 'admin' && !isAdminShell.value) return true;
  return false;
});

const showManagerShell = computed(() => {
  if (!user.value) return false;
  return user.value.role === 'manager' || user.value.role === 'hr';
});

/** Режим «Сотрудник» у руководителя — тот же shell, что у сотрудника на проде. */
const showManagerAsEmployee = computed(
  () => showManagerShell.value && managerUiMode.value === 'employee'
);

/** Календарь и статистика по ограниченной команде (подчинённые руководителя). */
const usesScopedTeamView = computed(
  () => isManager.value && !canSeeAllVacationApprovals.value
);

const visibleTabs = computed(() => {
  const tabs = [{ id: 'calendar' as const, label: 'Календарь' }];
  if (canApproveVacations.value) tabs.push({ id: 'approval' as const, label: 'Согласование' });
  return tabs;
});

const groupByDepartment = (list: ReturnType<typeof allReportsForAuthUser>) => {
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

/** Руководитель видит подчинённых из справочника (прямых и через тимлидов) и себя. */
const managerTeam = computed(() => {
  if (!isManager.value || canSeeAllVacationApprovals.value) return [];
  const me = findByUserForAuth(user.value);
  const reports = allReportsForAuthUser(user.value);
  if (!me) return reports;
  if (reports.some((emp) => emp.id === me.id)) return reports;
  return [me, ...reports].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
});

const scopedTeamMembers = computed(() => {
  if (isManager.value && !canSeeAllVacationApprovals.value) return managerTeam.value;
  return [];
});

const calendarDepartments = computed(() => {
  if (usesScopedTeamView.value) {
    const managerName = managerProfileName(user.value) || '';
    const managerEmployee = findByUserForAuth(user.value);
    const department = managerEmployee?.department?.trim() ?? '';

    if (
      department &&
      isGroupedVacationDepartment(department) &&
      (isVacationDepartmentDirector(managerName, department) ||
        isVacationGroupLead(managerName, department))
    ) {
      const groupedDeps = resolveManagerCalendarDepartments(managerName, employees.value, {
        directReports,
        findByName
      });
      if (groupedDeps.length) return groupedDeps;
    }
    return groupByDepartment(scopedTeamMembers.value);
  }
  return departmentsGrouped.value;
});

const showDepartmentDailyCounts = computed(() => {
  if (!usesScopedTeamView.value) return false;
  const managerName = managerProfileName(user.value)?.trim() ?? '';
  const department = findByUserForAuth(user.value)?.department?.trim() ?? '';
  return Boolean(department && isVacationDepartmentDirector(managerName, department));
});

const approvalQueue = computed(() =>
  pendingRequestsForApprover(managerProfileName(user.value) || null, canSeeAllVacationApprovals.value)
);

type ApprovalPanelEntry = { request: VacationRequest; handedOff: boolean };

const approvalPanelEntries = computed<ApprovalPanelEntry[]>(() => {
  const approver = managerProfileName(user.value) || null;
  const seeAll = canSeeAllVacationApprovals.value;
  const actionable = pendingRequestsForApprover(approver, seeAll);
  const handedOff = handedOffRequestsForApprover(approver, seeAll);
  const actionableIds = new Set(actionable.map((row) => row.id));
  return [
    ...actionable.map((request) => ({ request, handedOff: false })),
    ...handedOff
      .filter((request) => !actionableIds.has(request.id))
      .map((request) => ({ request, handedOff: true }))
  ];
});

const teamMembers = computed(() => {
  if (usesScopedTeamView.value) {
    return scopedTeamMembers.value;
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

const employeeInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
};

const overlapScopeNames = computed(() => {
  if (usesScopedTeamView.value) {
    return teamEmployeeNames.value;
  }
  return undefined;
});

const overlapDetails = (req: VacationRequest) =>
  findVacationOverlapDetails(req, yearRequests.value, overlapScopeNames.value);

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

const approvalStepLabel = (req: VacationRequest) =>
  requestStatusLabel(req, findByName(req.employee));

const handoffStatusLabel = (req: VacationRequest) =>
  vacationPendingStatusLabel('director', findByName(req.employee) ?? undefined);

const approve = (id: number) => approveRequest(id, managerProfileName(user.value) || null);
const reject = (id: number) => setRequestStatus(id, 'rejected');

const onViewYearChange = (year: number) => {
  viewYear.value = year;
};

const setActiveTab = (tab: 'calendar' | 'approval') => {
  activeTab.value = tab;
  if (tab === 'approval') notifyApprovalTabOpened();
};

watch(
  () => currentStep.value?.id,
  (stepId) => {
    if (!isManagerTrainingActive.value) return;
    if (stepId === 'calendar-view') activeTab.value = 'calendar';
  }
);

onMounted(() => {
  applyTabFromRoute();
  reloadEmployees();
  reloadVacations();
});

watch(() => route.query.tab, () => applyTabFromRoute());
</script>
