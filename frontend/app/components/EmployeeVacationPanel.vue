<template>
  <VacationTrainingOverlay v-if="vacationTrainingEnabled" />

  <div class="vac-emp-page" :class="embedded ? 'vac-emp-page--embedded' : 'vac-emp-page--fit'">
    <header class="vac-emp-toolbar vac-emp-toolbar--desk">
      <form class="vac-emp-toolbar__form" data-tour="vac-create-form" @submit.prevent="submitRequest">
        <h3 class="vac-emp-toolbar__title">Создать заявку на отпуск</h3>
        <span class="vac-emp-toolbar__word">с</span>
        <input
          v-model="form.start"
          type="date"
          class="vac-emp-input"
          aria-label="Дата начала"
          :min="allowPastDates ? undefined : minIso"
          :disabled="isHistoricalYear || submitting"
        />
        <span class="vac-emp-toolbar__word">по</span>
        <input
          v-model="form.end"
          type="date"
          class="vac-emp-input"
          aria-label="Дата окончания"
          :min="allowPastDates ? undefined : minIso"
          :disabled="isHistoricalYear || submitting"
        />
        <span
          ref="createBtnWrapRef"
          class="vac-emp-btn-wrap"
          @mouseenter="onCreateBtnEnter"
          @mouseleave="onCreateBtnLeave"
        >
          <button
            class="vac-emp-btn"
            type="submit"
            :disabled="isHistoricalYear || submitting || formShortfallBlocked"
          >
            {{ submitting ? 'Сохранение…' : 'Создать заявку' }}
          </button>
        </span>
        <Teleport to="body">
          <div
            v-if="createBtnTipVisible"
            class="vac-emp-create-tip"
            role="tooltip"
            :style="createBtnTipStyle"
          >
            {{ props.viewYear }} год — только просмотр, заявку создать нельзя
          </div>
        </Teleport>
        <p
          v-if="formShortfallBlocked"
          class="vac-shortfall-error vac-shortfall-error--toolbar"
          role="alert"
        >
          {{ formShortfall.message }}
          <span class="vac-shortfall-error__meta">
            к {{ formShortfall.assessment.startLabel }} будет
            {{ formatVacationDaysAmount(formShortfall.assessment.availableAtStart) }} из
            {{ formShortfall.assessment.neededDays }}
          </span>
        </p>
        <p
          v-if="!isHistoricalYear && formGroupLeadOverlapDetails.length"
          class="vac-emp-toolbar__glh-overlap"
          role="status"
        >
          <VacOverlapPopover
            :items="formGroupLeadOverlapDetails"
            :format-range="formatVacationRange"
            :badge-label="GROUP_LEAD_OVERLAP_BADGE_LABEL"
            :title="GROUP_LEAD_OVERLAP_POPOVER_TITLE"
          />
        </p>
        <p v-if="!isHistoricalYear && clarifyHint" class="vac-emp-toolbar__clarify-hint" role="status">
          {{ clarifyHint }}
        </p>
      </form>
    </header>

    <!-- Мобилка ≤900: форма + баланс + вкладки по эскизу -->
    <div v-if="!embedded" class="vac-mob-chrome" aria-label="Заявка и навигация">
      <div class="vac-mob-chrome__row">
        <form class="vac-mob-dates" data-tour="vac-create-form" @submit.prevent="submitRequest">
          <label class="vac-mob-dates__field">
            <span>с</span>
            <span class="vac-mob-dates__control">
              <input
                v-model="form.start"
                type="date"
                :class="{ 'is-empty': !form.start }"
                :min="allowPastDates ? undefined : minIso"
                :disabled="isHistoricalYear || submitting"
              />
              <span v-if="!form.start" class="vac-mob-dates__ph" aria-hidden="true">дд.мм.гггг</span>
            </span>
          </label>
          <label class="vac-mob-dates__field">
            <span>по</span>
            <span class="vac-mob-dates__control">
              <input
                v-model="form.end"
                type="date"
                :class="{ 'is-empty': !form.end }"
                :min="allowPastDates ? undefined : minIso"
                :disabled="isHistoricalYear || submitting"
              />
              <span v-if="!form.end" class="vac-mob-dates__ph" aria-hidden="true">дд.мм.гггг</span>
            </span>
          </label>
          <button
            type="submit"
            class="vac-mob-dates__ok"
            aria-label="Создать заявку"
            :disabled="isHistoricalYear || submitting || !form.start || !form.end || formShortfallBlocked"
          >
            <!-- SVG, а не символ «✓»: у глифа своя метрика шрифта, и он съезжал от центра -->
            <svg class="vac-mob-dates__ok-icon" viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
              <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </form>
        <div class="vac-mob-balance" data-tour="vac-balance" aria-label="Доступно дней отпуска">
          <span class="vac-mob-balance__num">{{ mobileBalanceRemain }}</span>
          <VacInfoHint
            class="vac-mob-balance__hint"
            label="Доступно дней отпуска"
            :text="VACATION_HINT_AVAILABLE"
            reservations-note
          />
        </div>
      </div>

      <p v-if="!isHistoricalYear && clarifyHint" class="vac-mob-chrome__hint">{{ clarifyHint }}</p>
      <p v-if="formShortfallBlocked" class="vac-mob-chrome__err" role="alert">{{ formShortfall.message }}</p>
      <p v-if="formError" class="vac-mob-chrome__err">
        <strong>{{ formError.title }}:</strong> {{ formError.text }}
      </p>

      <nav class="vac-mob-tabs" aria-label="Календарь">
        <VacationYearTab
          class="vac-mob-tabs__year"
          :model-value="props.viewYear"
          :years="yearOptions"
          @update:model-value="emit('update:viewYear', $event)"
        />
        <button
          type="button"
          class="vac-mob-tabs__btn vac-mob-tabs__btn--mine"
          :class="{ 'is-on': mobChromeTab === 'calendar' && calendarScope === 'mine' }"
          @click="setMobChrome('mine')"
        >
          Мой
        </button>
        <button
          v-if="hasTeamCalendar"
          type="button"
          class="vac-mob-tabs__btn"
          :class="{ 'is-on': mobChromeTab === 'calendar' && calendarScope === 'team' }"
          @click="setMobChrome('team')"
        >
          Общий
        </button>
        <button
          type="button"
          class="vac-mob-tabs__btn"
          :class="{ 'is-on': mobChromeTab === 'requests' }"
          @click="mobChromeTab = 'requests'"
        >
          Заявки
        </button>
      </nav>
    </div>

    <p v-if="formError" class="vac-emp-error">
      <strong>{{ formError.title }}:</strong> {{ formError.text }}
    </p>

    <Teleport to="body">
      <aside
        v-if="requestCreatedToast"
        class="vac-request-created-toast"
        role="status"
        aria-live="polite"
      >
        <button
          type="button"
          class="vac-request-created-toast__close"
          aria-label="Закрыть"
          @click="dismissRequestCreatedToast"
        >
          ×
        </button>
        <div class="vac-request-created-toast__decor" aria-hidden="true">
          <span class="vac-request-created-toast__blob vac-request-created-toast__blob--a" />
          <span class="vac-request-created-toast__blob vac-request-created-toast__blob--b" />
        </div>
        <div class="vac-request-created-toast__icon" aria-hidden="true">
          <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
            <circle cx="20" cy="20" r="20" fill="#1e4a48" />
            <path
              d="M12.5 15.2c0-2.4 2.1-4.4 4.7-4.4h5.6c2.6 0 4.7 2 4.7 4.4v5.1c0 2.4-2.1 4.4-4.7 4.4h-1.3l-3.2 2.6v-2.6h-1.1c-2.6 0-4.7-2-4.7-4.4v-5.1z"
              stroke="#fff"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
            <path
              d="M16.8 19.1l2.2 2.2 4.2-4.4"
              stroke="#fff"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="vac-request-created-toast__copy">
          <p class="vac-request-created-toast__title">Заявка создана</p>
          <p class="vac-request-created-toast__route">{{ requestCreatedToast.route }}</p>
        </div>
        <div class="vac-request-created-toast__glass">
          <span class="vac-request-created-toast__glass-mark" aria-hidden="true">!</span>
          <p class="vac-request-created-toast__glass-text">{{ requestCreatedToast.note }}</p>
        </div>
      </aside>
    </Teleport>

    <div class="vac-emp-body" :class="{ 'vac-emp-body--embedded': embedded }">
        <div
          v-show="mobChromeTab === 'calendar'"
          ref="calendarSlotRef"
          class="vac-emp-calendar-slot"
          :class="{ 'vac-emp-calendar-slot--with-tabs': hasTeamCalendar }"
        >
        <div class="vac-emp-calendar-main">
          <VacationYearTab
            class="vac-emp-calendar-yeartab vac-emp-calendar-yeartab--desk"
            :model-value="props.viewYear"
            :years="yearOptions"
            @update:model-value="emit('update:viewYear', $event)"
          />
          <button
            v-if="focusedMonthIndex != null"
            type="button"
            class="vac-emp-cal-back-year"
            @click="exitMonthFocus"
          >
            ← Весь год
          </button>
          <section
            ref="calendarPaneRef"
            class="vac-emp-calendar-pane"
            :class="{
              'vac-emp-calendar-pane--embedded': embedded,
              'vac-emp-calendar-pane--team': showTeamCalendar,
              'vac-emp-calendar-pane--month-focus': focusedMonthIndex != null
            }"
            :style="teamPaneFitStyle"
            data-tour="vac-calendar"
          >
            <VacationTeamCalendar
              v-if="showTeamCalendar"
              variant="employee-team"
              :departments="teamDepartments"
              :requests="yearRequests"
              :reservations="employeeReservationsList"
              :get-month-entries="getMonthEntries"
              :year="props.viewYear"
            />
            <!-- Мобилка: учётный и следующий год одной лентой (на десктопе обёртки — display: contents, всегда один год) -->
            <div
              v-else-if="employeeName"
              ref="yearStackRef"
              class="vac-emp-year-stack"
              :class="{ 'vac-emp-year-stack--multi': stackYears.length > 1 }"
              @scroll.passive="onYearStackScroll"
            >
              <div
                v-for="(stackYear, stackIndex) in stackYears"
                :key="stackYear"
                class="vac-emp-year-stack__year"
                :data-year="stackYear"
              >
                <p v-if="stackIndex > 0" class="vac-emp-year-stack__label">{{ stackYear }}</p>
                <EmployeeYearCalendar
                  compact
                  :employee-name="employeeName"
                  :year="stackYear"
                  :requests="displayRequests"
                  :reservations="stackYear === props.viewYear ? employeeReservationsList : reservationsForStackYear(stackYear)"
                  :highlight-month-index="stackYear === props.viewYear ? highlightMonthIndex : null"
                  :focused-month-index="focusedMonthIndex"
                  :range-pick-start="isHistoricalYear ? null : rangePickStart"
                  :range-pick-hover="isHistoricalYear ? null : rangePickHover"
                  :selected-range-start="isHistoricalYear ? null : form.start || null"
                  :selected-range-end="isHistoricalYear ? null : form.end || null"
                  :min-selectable-iso="minIso"
                  :read-only="isHistoricalYear"
                  :reservation-control-override="isHistoricalYear || stackYear !== props.viewYear ? null : reservationControlOverride"
                  :reservation-cap-blocked-months="isHistoricalYear ? [] : stackYear === props.viewYear ? reservationCapBlockedMonths : capBlockedMonthsForYear(stackYear)"
                  @day-click="onStackDayClick(stackYear, $event)"
                  @day-hover="onCalendarDayHover"
                  @month-focus="onStackMonthFocus(stackYear, $event)"
                  @reservation-month-click="onStackReservationClick(stackYear, $event)"
                  @reservation-cap-blocked="onStackCapBlocked(stackYear, $event)"
                />
              </div>
            </div>
            <p v-else class="vac-emp-empty">
              Нет записи в справочнике сотрудников для вашего аккаунта. Попросите HR добавить вас в справочник с
              вашим email.
            </p>
          </section>
        </div>
        <VacationCalendarScopeToggle
          v-if="hasTeamCalendar"
          class="vac-cal-side-tabs--desk"
          :model-value="calendarScope"
          @update:model-value="setCalendarScope"
        />
      </div>

      <EmployeeVacationAside
        v-if="!embedded"
        class="vac-emp-aside-host"
        :class="{ 'vac-emp-aside-host--requests': mobChromeTab === 'requests' }"
        :view-year="viewYear"
        :ui-mode="uiMode"
        :team-mode-label="teamModeLabel"
        @update:ui-mode="onUiModeChange"
        @clarify-reservation="clarifyReservation"
      />
    </div>

    <VacationReservationDialog
      v-model:open="reservationDialogOpen"
      :year="props.viewYear"
      :month-index="reservationMonthIndex"
      :month-label="MONTHS_RU[reservationMonthIndex] ?? ''"
      :employee-name="employeeName"
      :editing-reservation="editingReservation"
    />

    <div
      v-if="reservationCapNoticeOpen"
      class="vac-cap-notice-backdrop"
      role="presentation"
      @click="reservationCapNoticeOpen = false"
    />
    <div
      v-if="reservationCapNoticeOpen"
      class="vac-cap-notice"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="vac-cap-notice-title"
    >
      <h4 id="vac-cap-notice-title" class="vac-cap-notice__title">Бронь недоступна</h4>
      <p class="vac-cap-notice__text">{{ reservationCapNoticeText }}</p>
      <button type="button" class="vac-emp-btn" @click="reservationCapNoticeOpen = false">Понятно</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { buildDaySetsForEmployee, isVacationStartInPast, todayIso } from '~/utils/vacationCalendar';
import { vacationBelongsToEmployee } from '~/utils/vacationEmployeeRef';
import { calcEmployeeBalance } from '~/utils/vacationBalance';
import { assessVacationShortfall, formatVacationDaysAmount } from '~/utils/vacationShortfall';
import { requestsAroundYear, vacationBookingYearError } from '~/utils/vacationBookingYears';
import { VACATION_HINT_AVAILABLE } from '~/utils/vacationBalanceHints';
import type { VacationRequest } from '~/composables/useVacations';
import type { VacationReservation } from '~/utils/vacationReservations';
import {
  canAddReservationForMonth,
  canManageReservationMonth
} from '~/utils/vacationReservations';
import { resolveEmployeeReservationCapContext } from '~/utils/vacationDepartmentGroups';
import {
  getReservationMonthBlockReason,
  getReservationRangeBlockReason,
  reservationCapBlockMessage,
  toEmployeeReservationCapContext,
  vacationRequestCapBlockMessage,
  RESERVATION_CAP_DEPARTMENT_BLOCKED_MESSAGE
} from '~/utils/vacationReservationCaps';
import {
  findGroupLeadVacationOverlaps,
  GROUP_LEAD_OVERLAP_BADGE_LABEL,
  GROUP_LEAD_OVERLAP_BLOCKED_MESSAGE,
  GROUP_LEAD_OVERLAP_POPOVER_TITLE
} from '~/utils/vacationGroupLeadOverlap';
import { needsTwoStepApproval } from '~/utils/vacationApproval';

const props = defineProps<{
  viewYear: number;
  /** Календарь в колонке руководителя; боковая панель — в ManagerVacationAside */
  embedded?: boolean;
  /** Переключатель «отдел / сотрудник» для наблюдателя отдела (полный экран сотрудника). */
  uiMode?: 'manager' | 'employee';
  teamModeLabel?: string;
}>();

const emit = defineEmits<{
  'update:viewYear': [value: number];
  'update:uiMode': [value: 'manager' | 'employee'];
}>();

const onUiModeChange = (mode: 'manager' | 'employee') => {
  emit('update:uiMode', mode);
};

const { user } = useAuth();
const runtimeConfig = useRuntimeConfig();
const vacationTrainingEnabled = computed(() => runtimeConfig.public.vacationTrainingEnabled === true);
const { isAdmin } = usePermissions();
/** Задним числом — только admin (не HR, не сотрудник). */
const allowPastDates = computed(() => isAdmin.value);
const {
  findByUserForAuth,
  directReports,
  findByName,
  employeesInDepartment,
  employees: allEmployees,
  hydrate: hydrateEmployees
} = useEmployees();
/** Оргструктура уже грузится в bootstrapAppData: группы Digital для лимита «1 на группу». */
const { orgUnits, orgLinks } = useOrgStructure();
const {
  requestsForYear,
  employeeReservations,
  addRequest,
  deleteReservation,
  hydrate: hydrateVacations,
  state,
  getMonthEntries,
  allReservations,
  MONTHS_RU
} = useVacations();
const {
  hasTeamCalendar,
  teamDepartments,
  calendarScope,
  setCalendarScope
} = useEmployeeVacationTeamView();
const {
  isActive: isTrainingActive,
  currentStep: trainingStep,
  addTrainingRequest,
  addTrainingReservation,
  mergeReservationsForDisplay,
  trainingReservationMonth,
  notifyCalendarRangeSelected,
  mergeRequestsForDisplay
} = useVacationTraining();

const yearRequests = computed(() => requestsForYear(props.viewYear));
/** Свой календарь и проверка пересечений: соседние папки, чтобы отпуск через Новый год был виден в обоих годах. */
const displayRequests = computed(() =>
  mergeRequestsForDisplay(props.viewYear, requestsAroundYear(state.value.requestsByYear, props.viewYear))
);
/** Для лимитов: только реальные заявки (без учебных), все годы. */
const capRequests = computed(() => Object.values(state.value.requestsByYear).flat());
const employeeReservationsList = computed(() => {
  if (!employeeName.value) return [];
  const real = employeeReservations(employeeName.value, props.viewYear);
  return mergeReservationsForDisplay(props.viewYear, real);
});

/** Прошлые учётные годы — только просмотр календаря, без заявок и броней. */
const isHistoricalYear = computed(() => props.viewYear < state.value.primaryYear);

const createBtnWrapRef = ref<HTMLElement | null>(null);
const createBtnTipVisible = ref(false);
const createBtnTipStyle = ref<Record<string, string>>({});
const calendarSlotRef = ref<HTMLElement | null>(null);
const calendarPaneRef = ref<HTMLElement | null>(null);
/** Белая рамка «Общего» ≥ вкладок; строки остаются обычной высоты. */
const teamPaneMinHeightPx = ref<number | null>(null);

const onCreateBtnEnter = () => {
  if (!isHistoricalYear.value) return;
  const el = createBtnWrapRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  createBtnTipStyle.value = {
    top: `${Math.round(rect.bottom + 8)}px`,
    left: `${Math.round(rect.left + rect.width / 2)}px`
  };
  createBtnTipVisible.value = true;
};

const onCreateBtnLeave = () => {
  createBtnTipVisible.value = false;
};

watch(isHistoricalYear, (historical) => {
  if (!historical) createBtnTipVisible.value = false;
});

/** Прошлый, текущий учётный и следующий год (бронь/заявки на будущий год разрешены). */
const yearOptions = computed(() => {
  const primary = state.value.primaryYear;
  return [primary - 1, primary, primary + 1].filter((year) => year > 0);
});

watch(
  yearOptions,
  (years) => {
    if (!years.length || years.includes(props.viewYear)) return;
    const fallback = years.includes(state.value.primaryYear) ? state.value.primaryYear : years[0]!;
    emit('update:viewYear', fallback);
  },
  { immediate: true }
);

const reservationDialogOpen = ref(false);
const reservationMonthIndex = ref(0);
const editingReservation = ref<VacationReservation | null>(null);
const highlightMonthIndex = ref<number | null>(null);
const pendingClarifyReservationId = ref<number | null>(null);
const clarifyHint = ref('');
const reservationCapNoticeOpen = ref(false);
const reservationCapNoticeText = ref(RESERVATION_CAP_DEPARTMENT_BLOCKED_MESSAGE);

const openReservationCapNotice = (monthIndex: number) => {
  const ctx = reservationCapContext.value;
  if (ctx) {
    const reason = getReservationMonthBlockReason({
      context: toEmployeeReservationCapContext(ctx),
      year: props.viewYear,
      month: monthIndex + 1,
      reservations: allReservations.value,
      requests: capRequests.value,
      caps: state.value.reservationMonthlyCapsByGroup,
      excludeEmployee: employeeName.value
    });
    reservationCapNoticeText.value = reason
      ? reservationCapBlockMessage(reason)
      : RESERVATION_CAP_DEPARTMENT_BLOCKED_MESSAGE;
  }
  reservationCapNoticeOpen.value = true;
};

const clarifyReservation = (reservation: { id: number; month: number; year: number; durationDays: number; isTraining?: boolean }) => {
  if ('isTraining' in reservation && reservation.isTraining && isTrainingActive.value) {
    highlightMonthIndex.value = reservation.month - 1;
    form.start = '';
    form.end = '';
    clearSelection();
    formError.value = null;
    clarifyHint.value =
      'Выберите конкретные даты на календаре или в форме выше — после создания заявки учебная бронь исчезнет.';
    document.querySelector('.vac-emp-toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  pendingClarifyReservationId.value = reservation.id;
  highlightMonthIndex.value = reservation.month - 1;
  const monthName = MONTHS_RU[reservation.month - 1] ?? '';
  clarifyHint.value = `Создайте заявку на ${monthName} ${reservation.year} (бронь ~${reservation.durationDays} дн.) — выберите период на календаре или в форме выше.`;
  form.start = '';
  form.end = '';
  clearSelection();
  formError.value = null;
  document.querySelector('.vac-emp-toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

const currentEmployee = computed(() => findByUserForAuth(user.value));
const employeeName = computed(() => currentEmployee.value?.name ?? '');

const reservationCapContext = computed(() => {
  const emp = currentEmployee.value;
  if (!emp) return null;
  return resolveEmployeeReservationCapContext(emp, {
    directReports,
    findByName,
    employeesInDepartment,
    allEmployees: allEmployees.value,
    orgStructure: orgUnits.value.length ? { units: orgUnits.value, links: orgLinks.value } : null
  });
});

const capBlockedMonthsForYear = (year: number): number[] => {
  const ctx = reservationCapContext.value;
  if (!ctx) return [] as number[];
  const blocked: number[] = [];
  const caps = state.value.reservationMonthlyCapsByGroup;
  const reservations = allReservations.value;
  const capContext = toEmployeeReservationCapContext(ctx);
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    if (
      getReservationMonthBlockReason({
        context: capContext,
        year,
        month: monthIndex + 1,
        reservations,
        requests: capRequests.value,
        caps,
        excludeEmployee: employeeName.value
      })
    ) {
      blocked.push(monthIndex);
    }
  }
  return blocked;
};

const reservationCapBlockedMonths = computed(() => capBlockedMonthsForYear(props.viewYear));

const showTeamCalendar = computed(
  () => hasTeamCalendar.value && calendarScope.value === 'team' && Boolean(employeeName.value)
);

const teamPaneFitStyle = computed(() => {
  if (!showTeamCalendar.value || teamPaneMinHeightPx.value == null) return undefined;
  return { '--vac-team-pane-min-h': `${teamPaneMinHeightPx.value}px` };
});

const fitTeamTableToSideTabs = async () => {
  if (!import.meta.client || !showTeamCalendar.value) {
    teamPaneMinHeightPx.value = null;
    return;
  }
  await nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const slot = calendarSlotRef.value;
  const tabs = slot?.querySelector('.vac-cal-side-tabs') as HTMLElement | null;
  if (!tabs) {
    teamPaneMinHeightPx.value = null;
    return;
  }

  teamPaneMinHeightPx.value = null;
  await nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  // Белое поле только до низа вкладок (не до края экрана), строки не трогаем.
  teamPaneMinHeightPx.value = Math.ceil(tabs.offsetHeight);
};

const hireIso = computed(() => currentEmployee.value?.hired_at ?? '');

/** Своя заявка: нехватка дней блокирует подачу (та же функция, что на сервере). */
const formShortfall = computed(() =>
  assessVacationShortfall({
    employeeName: employeeName.value,
    hireIso: hireIso.value,
    start: form.start,
    end: form.end,
    requests: capRequests.value,
    primaryYear: state.value.primaryYear,
    openingBalance: currentEmployee.value?.vacation_opening_balance
  })
);
const formShortfallBlocked = computed(
  () => !isHistoricalYear.value && !isTrainingActive.value && formShortfall.value.shortfall > 0
);

const form = reactive({ start: '', end: '' });
const formError = ref<{ title: string; text: string } | null>(null);
const submitting = ref(false);

type RequestCreatedToast = {
  route: string;
  note: string;
};
const requestCreatedToast = ref<RequestCreatedToast | null>(null);
let requestCreatedToastTimer: ReturnType<typeof setTimeout> | null = null;

const REQUEST_CREATED_NOTE =
  'Пока статус желтый — отпуск еще не одобрен. Билеты лучше не покупать заранее.';

const dismissRequestCreatedToast = () => {
  requestCreatedToast.value = null;
  if (requestCreatedToastTimer) {
    clearTimeout(requestCreatedToastTimer);
    requestCreatedToastTimer = null;
  }
};

const showRequestCreatedToast = () => {
  dismissRequestCreatedToast();
  const emp = currentEmployee.value;
  const twoStep = emp ? needsTwoStepApproval(emp) : false;
  requestCreatedToast.value = {
    route: twoStep
      ? 'Она ушла группхеду. После него — директор отдела.'
      : 'Она ушла руководителю на согласование.',
    note: REQUEST_CREATED_NOTE
  };
  requestCreatedToastTimer = setTimeout(() => {
    requestCreatedToast.value = null;
    requestCreatedToastTimer = null;
  }, 20000);
};

onUnmounted(() => {
  dismissRequestCreatedToast();
});

const formatVacationRange = (start: string, end: string) => {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(start)} — ${fmt(end)}`;
};

const formGroupLeadOverlapDetails = computed(() => {
  const emp = currentEmployee.value;
  if (!emp || !form.start || !form.end || form.end < form.start) return [];
  return findGroupLeadVacationOverlaps({
    employeeName: emp.name,
    department: emp.department,
    start: form.start,
    end: form.end,
    allRequests: capRequests.value
  });
});

/** Мобилка ≤900: тап по месяцу/дате приближает месяц. */
const isMobileCal = ref(false);
const focusedMonthIndex = ref<number | null>(null);

/**
 * Мобилка, «Мой», весь год: учётный и следующий год одной лентой — после декабря сразу январь.
 * Других лет в ленте нет (бронировать можно только primaryYear и primaryYear + 1).
 */
const stackYears = computed<number[]>(() => {
  const year = props.viewYear;
  const primary = state.value.primaryYear;
  if (!isMobileCal.value || showTeamCalendar.value || focusedMonthIndex.value != null) return [year];
  if (year !== primary && year !== primary + 1) return [year];
  const years = [primary, primary + 1].filter((y) => yearOptions.value.includes(y));
  return years.length ? years : [year];
});

const reservationsForStackYear = (year: number) => {
  if (!employeeName.value) return [];
  return mergeReservationsForDisplay(year, employeeReservations(employeeName.value, year));
};

const blockedDays = computed(() => {
  if (!employeeName.value) return new Set<string>();
  const days = new Set<string>();
  // Лента из двух лет на мобилке: отпуск через Новый год проверяется по обоим годам
  for (const year of stackYears.value) {
    const { approved, pending } = buildDaySetsForEmployee(employeeName.value, year, displayRequests.value);
    for (const iso of approved) days.add(iso);
    for (const iso of pending) days.add(iso);
  }
  return days;
});

const {
  rangePickStart,
  rangePickHover,
  minIso,
  clearSelection,
  handleDayClick,
  handleDayHover
} = useVacationRangePick({
  blockedDays,
  onRangeSelected: (start, end) => {
    form.start = start;
    form.end = end;
    formError.value = null;
    notifyCalendarRangeSelected();
  },
  hasCommittedRange: () => Boolean(form.start && form.end),
  onCleared: () => {
    form.start = '';
    form.end = '';
    formError.value = null;
  }
});

const MOBILE_CAL_MQ = '(max-width: 900px)';
/** calendar | requests — вкладки эскиза */
const mobChromeTab = ref<'calendar' | 'requests'>('calendar');
let mobileCalMq: MediaQueryList | null = null;

const syncMobileCal = () => {
  isMobileCal.value = Boolean(mobileCalMq?.matches);
  if (!isMobileCal.value) {
    focusedMonthIndex.value = null;
    mobChromeTab.value = 'calendar';
  }
};

const yearStackRef = ref<HTMLElement | null>(null);
/** Год сменился изнутри ленты (прокрутка, тап по дню другого года) — выбранные даты не сбрасываем. */
let yearChangeFromStack = false;
/** Куда прокрутить ленту, когда она снова соберётся (выход из месяца, первый показ). */
let stackScrollTarget: { year: number; month: number | null } | null = null;

const setYearFromStack = (year: number) => {
  if (year === props.viewYear) return;
  yearChangeFromStack = true;
  emit('update:viewYear', year);
};

const scrollStackTo = (year: number, monthIndex: number | null = null) => {
  const stack = yearStackRef.value;
  if (!stack || stackYears.value.length < 2) return;
  const section = stack.querySelector<HTMLElement>(`.vac-emp-year-stack__year[data-year="${year}"]`);
  if (!section) return;
  const month = monthIndex != null ? section.querySelectorAll<HTMLElement>('.emp-cal-month')[monthIndex] : null;
  const target = month ?? section;
  const delta = target.getBoundingClientRect().top - stack.getBoundingClientRect().top;
  stack.scrollTop = Math.max(0, stack.scrollTop + delta - (month ? 8 : 0));
};

/** Год в селекте = год, который сейчас занимает верх ленты. */
const onYearStackScroll = () => {
  const stack = yearStackRef.value;
  if (!stack || stackYears.value.length < 2) return;
  const line = stack.getBoundingClientRect().top + stack.clientHeight * 0.35;
  let visible = stackYears.value[0]!;
  for (const section of stack.querySelectorAll<HTMLElement>('.vac-emp-year-stack__year')) {
    if (section.getBoundingClientRect().top <= line) visible = Number(section.dataset.year);
  }
  setYearFromStack(visible);
};

watch(
  () => stackYears.value.length > 1,
  (multi) => {
    if (!multi) return;
    const target = stackScrollTarget ?? { year: props.viewYear, month: null };
    stackScrollTarget = null;
    scrollStackTo(target.year, target.month);
  },
  { flush: 'post' }
);

const exitMonthFocus = () => {
  if (focusedMonthIndex.value != null) {
    stackScrollTarget = { year: props.viewYear, month: focusedMonthIndex.value };
  }
  focusedMonthIndex.value = null;
};

const setMobChrome = (scope: 'mine' | 'team') => {
  mobChromeTab.value = 'calendar';
  setCalendarScope(scope);
  focusedMonthIndex.value = null;
};

const onMonthFocus = (monthIndex: number) => {
  if (!isMobileCal.value) return;
  if (monthIndex < 0 || monthIndex > 11) return;
  focusedMonthIndex.value = monthIndex;
};

const mobileBalanceRemain = computed(() => {
  const y = state.value.primaryYear;
  return calcEmployeeBalance(
    employeeName.value,
    hireIso.value,
    capRequests.value,
    new Date(),
    y,
    currentEmployee.value?.vacation_opening_balance
  ).remain;
});

const onCalendarDayClick = (...args: Parameters<typeof handleDayClick>) => {
  if (isHistoricalYear.value) return;
  const cell = args[0];
  if (isMobileCal.value && cell && !cell.empty && cell.iso) {
    const month = Number(cell.iso.slice(5, 7)) - 1;
    if (month >= 0 && month <= 11 && focusedMonthIndex.value !== month) {
      focusedMonthIndex.value = month;
    }
  }
  handleDayClick(...args);
};

const onStackDayClick = (year: number, cell: Parameters<typeof handleDayClick>[0]) => {
  setYearFromStack(year);
  onCalendarDayClick(cell);
};

const onStackMonthFocus = (year: number, monthIndex: number) => {
  setYearFromStack(year);
  onMonthFocus(monthIndex);
};

const onStackReservationClick = async (year: number, monthIndex: number) => {
  if (year !== props.viewYear) {
    setYearFromStack(year);
    await nextTick();
  }
  openReservationDialog(monthIndex);
};

const onStackCapBlocked = async (year: number, monthIndex: number) => {
  if (year !== props.viewYear) {
    setYearFromStack(year);
    await nextTick();
  }
  openReservationCapNotice(monthIndex);
};

const onCalendarDayHover = (...args: Parameters<typeof handleDayHover>) => {
  if (isHistoricalYear.value) return;
  handleDayHover(...args);
};

watch(isHistoricalYear, (historical) => {
  if (!historical) return;
  clearSelection();
  form.start = '';
  form.end = '';
  formError.value = null;
  focusedMonthIndex.value = null;
});

watch(
  () => props.viewYear,
  (year) => {
    if (yearChangeFromStack) {
      yearChangeFromStack = false;
      return;
    }
    clearSelection();
    form.start = '';
    form.end = '';
    formError.value = null;
    clarifyHint.value = '';
    dismissRequestCreatedToast();
    const wasFocused = focusedMonthIndex.value != null;
    focusedMonthIndex.value = null;
    // Год выбран в селекте, лента уже собрана — прыгаем к этому году
    if (!wasFocused) void nextTick(() => scrollStackTo(year));
    else stackScrollTarget = { year, month: null };
  }
);

const reservationControlOverride = computed(() =>
  isTrainingActive.value && trainingStep.value?.id === 'reservation-book'
    ? trainingReservationMonth - 1
    : null
);

const openReservationDialog = (monthIndex: number) => {
  if (isHistoricalYear.value) return;
  if (rangePickStart.value) return;
  if (
    isTrainingActive.value &&
    trainingStep.value?.id === 'reservation-book' &&
    monthIndex !== trainingReservationMonth - 1
  ) {
    return;
  }

  const monthNum = monthIndex + 1;
  const existing = employeeReservationsList.value.find((r) => r.month === monthNum);
  const trainingBookStep =
    isTrainingActive.value && trainingStep.value?.id === 'reservation-book';

  if (!trainingBookStep) {
    if (existing) {
      if (!canManageReservationMonth(props.viewYear, monthNum)) return;
    } else if (!canAddReservationForMonth(props.viewYear, monthNum)) {
      return;
    }
  }
  reservationMonthIndex.value = monthIndex;
  editingReservation.value =
    employeeReservationsList.value.find((r) => r.month === monthIndex + 1) ?? null;
  reservationDialogOpen.value = true;
};

watch(reservationDialogOpen, (isOpen) => {
  if (!isOpen) editingReservation.value = null;
});

const hasConflict = (start: string, end: string, excludeId?: number) =>
  displayRequests.value.some(
    (r) =>
      r.id !== excludeId &&
      vacationBelongsToEmployee(r, { id: currentEmployee.value?.id, name: employeeName.value }) &&
      (r.status === 'approved' || r.status === 'pending') &&
      !(end < r.start || start > r.end)
  );

const submitRequest = async () => {
  formError.value = null;
  if (isHistoricalYear.value) {
    formError.value = {
      title: 'Только просмотр',
      text: `За ${props.viewYear} год заявки создать нельзя — переключитесь на ${state.value.primaryYear}.`
    };
    return;
  }
  if (!employeeName.value || !form.start || !form.end) {
    formError.value = { title: 'Заполните даты', text: 'Укажите дату начала и окончания отпуска.' };
    return;
  }
  if (form.end < form.start) {
    formError.value = { title: 'Некорректный период', text: 'Дата окончания не может быть раньше даты начала.' };
    return;
  }
  if (!allowPastDates.value && isVacationStartInPast(form.start, todayIso())) {
    formError.value = {
      title: 'Дата в прошлом',
      text: 'Нельзя оформить отпуск задним числом. Обратитесь к администратору.'
    };
    return;
  }
  const yearError = vacationBookingYearError(form.start, form.end, state.value.primaryYear);
  if (yearError) {
    formError.value = { title: 'Год недоступен', text: yearError };
    return;
  }
  if (formShortfallBlocked.value) {
    formError.value = { title: 'Не хватает дней', text: formShortfall.value.message };
    return;
  }
  if (hasConflict(form.start, form.end)) {
    formError.value = {
      title: 'Пересечение',
      text: 'На эти даты уже есть отпуск.'
    };
    return;
  }
  if (formGroupLeadOverlapDetails.value.length && !isAdmin.value) {
    formError.value = {
      title: 'Пересечение с отпуском другого групхеда',
      text: GROUP_LEAD_OVERLAP_BLOCKED_MESSAGE
    };
    return;
  }

  const capCtx = reservationCapContext.value;
  if (capCtx) {
    const rangeCapContext = toEmployeeReservationCapContext(capCtx);
    const capReason = getReservationRangeBlockReason({
      context: rangeCapContext,
      start: form.start,
      end: form.end,
      reservations: allReservations.value,
      requests: capRequests.value,
      caps: state.value.reservationMonthlyCapsByGroup,
      excludeEmployee: employeeName.value
    });
    if (capReason) {
      formError.value = {
        title: capReason === 'department' ? 'Даты заняты в отделе' : 'Даты заняты в группе',
        text: vacationRequestCapBlockMessage(
          capReason,
          rangeCapContext,
          state.value.reservationMonthlyCapsByGroup
        )
      };
      return;
    }
  }

  if (isTrainingActive.value) {
    if (trainingStep.value?.id !== 'create') {
      formError.value = {
        title: 'Учебный режим',
        text: 'Следуйте шагам квеста — сейчас нужно выполнить другое действие.'
      };
      return;
    }
    addTrainingRequest({ employee: employeeName.value, start: form.start, end: form.end });
    form.start = '';
    form.end = '';
    clearSelection();
    return;
  }

  submitting.value = true;
  dismissRequestCreatedToast();
  try {
    const created = await addRequest({ employee: employeeName.value, start: form.start, end: form.end });
    if (created) {
      showRequestCreatedToast();
    }
    if (created && pendingClarifyReservationId.value) {
      await deleteReservation(pendingClarifyReservationId.value);
      pendingClarifyReservationId.value = null;
      highlightMonthIndex.value = null;
      clarifyHint.value = '';
    } else if (created && isTrainingActive.value && trainingStep.value?.id === 'reservation-clarify') {
      highlightMonthIndex.value = null;
      clarifyHint.value = '';
    }
    form.start = '';
    form.end = '';
    clearSelection();
  } catch (error: unknown) {
    const statusMessage =
      error &&
      typeof error === 'object' &&
      'data' in error &&
      error.data &&
      typeof error.data === 'object' &&
      'statusMessage' in error.data &&
      typeof error.data.statusMessage === 'string'
        ? error.data.statusMessage
        : null;
    formError.value = {
      title: 'Не сохранилось',
      text: statusMessage ?? 'Заявка не дошла до сервера. Проверьте сеть и попробуйте ещё раз.'
    };
  } finally {
    submitting.value = false;
  }
};

const refreshData = () => {
  hydrateEmployees();
  hydrateVacations();
};

watch(
  () => user.value?.id,
  () => refreshData(),
  { immediate: true }
);

watch(
  () => trainingStep.value?.id,
  (stepId, prevStepId) => {
    if (!isTrainingActive.value) return;
    if (stepId === 'reservation-book' && calendarScope.value === 'team') {
      setCalendarScope('mine');
    }
    if (stepId === 'calendar' && prevStepId === 'create') {
      form.start = '';
      form.end = '';
      formError.value = null;
      clearSelection();
    }
  }
);

onMounted(() => {
  refreshData();
  void fitTeamTableToSideTabs();
  if (!import.meta.client) return;
  window.addEventListener('resize', fitTeamTableToSideTabs);
  mobileCalMq = window.matchMedia(MOBILE_CAL_MQ);
  syncMobileCal();
  mobileCalMq.addEventListener('change', syncMobileCal);
});

onBeforeUnmount(() => {
  if (!import.meta.client) return;
  window.removeEventListener('resize', fitTeamTableToSideTabs);
  mobileCalMq?.removeEventListener('change', syncMobileCal);
  mobileCalMq = null;
});

watch(
  [showTeamCalendar, () => teamDepartments.value.map((d) => d.employees.length).join(',')],
  () => {
    void fitTeamTableToSideTabs();
  }
);
</script>

<style scoped>
/* Десктоп: обёртки ленты не влияют на раскладку (один год, как раньше). Мобилка — mobile.css. */
.vac-emp-year-stack,
.vac-emp-year-stack__year {
  display: contents;
}

.vac-emp-year-stack__label {
  display: none;
}
</style>
