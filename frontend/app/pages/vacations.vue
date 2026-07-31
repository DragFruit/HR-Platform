<template>
  <div v-if="!authReady" class="auth-loading">Загрузка...</div>

  <template v-else>
    <div
      v-if="showFullEmployeeVacations"
      class="vacations-employee-shell"
    >
      <EmployeeVacationPanel
        :view-year="viewYear"
        @update:view-year="onViewYearChange"
      />
    </div>

    <VacationsManagerExperience v-else-if="showManagerShell" />

    <template v-else>
      <div class="vac-manager-layout">
        <div class="vac-manager-main">
          <VacationTeamCalendar
            :departments="departmentsGrouped"
            :requests="yearRequests"
            :reservations="yearReservations"
            :get-month-entries="getMonthEntries"
          />
        </div>
      </div>
    </template>
  </template>
</template>

<script setup lang="ts">
const { user, authReady } = useAuth();
const { isAdmin: isAdminShell } = usePlatformContext();
const { departmentsGrouped, reloadFromServer: reloadEmployees } = useEmployees();
const {
  viewYear,
  yearRequests,
  yearReservations,
  getMonthEntries,
  reloadFromServer: reloadVacations
} = useVacations();

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

const onViewYearChange = (year: number) => {
  viewYear.value = year;
};

onMounted(() => {
  reloadEmployees();
  reloadVacations();
});
</script>
