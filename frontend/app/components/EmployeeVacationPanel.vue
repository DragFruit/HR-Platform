<template>
  <VacationTrainingOverlay v-if="vacationTrainingEnabled" />

  <div class="vac-emp-page" :class="embedded ? 'vac-emp-page--embedded' : 'vac-emp-page--fit'">
    <header class="vac-emp-toolbar">
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
            :disabled="isHistoricalYear || submitting"
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
          v-if="!isHistoricalYear && formAssessment.status === 'advance'"
          class="vac-advance-notice vac-advance-notice--toolbar"
          role="status"
        >
          <span class="vac-advance-notice__text">
            Не хватает {{ formAssessment.deficit }} дн. · к {{ formAssessment.startLabel }} будет
            {{ formAssessment.availableAtStart }} из {{ formAssessment.neededDays }}
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
        <div class="vac-request-created-toast__art" aria-hidden="true">
          <span class="vac-request-created-toast__sq vac-request-created-toast__sq--lime vac-request-created-toast__sq--a" />
          <span class="vac-request-created-toast__sq vac-request-created-toast__sq--purple vac-request-created-toast__sq--b" />
          <span class="vac-request-created-toast__sq vac-request-created-toast__sq--lime vac-request-created-toast__sq--c" />
          <span class="vac-request-created-toast__sq vac-request-created-toast__sq--purple vac-request-created-toast__sq--d" />
          <img
            class="vac-request-created-toast__palm"
            src="/images/vacations/request-created-palm.png?v=4"
            alt=""
            width="110"
            height="110"
          />
        </div>
        <div class="vac-request-created-toast__main">
          <div class="vac-request-created-toast__copy">
            <p class="vac-request-created-toast__title">Заявка успешно создана</p>
            <p class="vac-request-created-toast__route">{{ requestCreatedToast.route }}</p>
          </div>
          <div
            class="vac-request-created-toast__path"
            :style="{ '--vac-toast-path-cols': String(requestCreatedToast.path.length) }"
            :aria-label="requestCreatedToast.path.map((s) => s.label).join(' → ')"
          >
            <span
              v-for="seg in requestCreatedToast.path"
              :key="seg.label"
              class="vac-request-created-toast__seg"
              :class="`is-${seg.state}`"
            >
              <span class="vac-request-created-toast__bar" aria-hidden="true">
                <span v-if="seg.state === 'current'" class="vac-request-created-toast__dot" />
              </span>
              <span class="vac-request-created-toast__seg-label">{{ seg.label }}</span>
            </span>
          </div>
        </div>
        <div class="vac-request-created-toast__warn">
          <span class="vac-request-created-toast__warn-badge" aria-hidden="true">●</span>
          <p class="vac-request-created-toast__warn-text">{{ requestCreatedToast.note }}</p>
        </div>
      </aside>
    </Teleport>

    <div class="vac-emp-body" :class="{ 'vac-emp-body--embedded': embedded }">
        <div
          ref="calendarSlotRef"
          class="vac-emp-calendar-slot"
          :class="{ 'vac-emp-calendar-slot--with-tabs': hasTeamCalendar }"
        >
        <div class="vac-emp-calendar-main">
          <VacationYearTab
            class="vac-emp-calendar-yeartab"
            :model-value="props.viewYear"
            :years="yearOptions"
            @update:model-value="emit('update:viewYear', $event)"
          />
          <section
            ref="calendarPaneRef"
            class="vac-emp-calendar-pane"
            :class="{
              'vac-emp-calendar-pane--embedded': embedded,
              'vac-emp-calendar-pane--team': showTeamCalendar
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
            <EmployeeYearCalendar
              v-else-if="employeeName"
              compact
              :employee-name="employeeName"
              :year="props.viewYear"
              :requests="displayRequests"
              :reservations="employeeReservationsList"
              :highlight-month-index="highlightMonthIndex"
              :range-pick-start="isHistoricalYear ? null : rangePickStart"
              :range-pick-hover="isHistoricalYear ? null : rangePickHover"
              :selected-range-start="isHistoricalYear ? null : form.start || null"
              :selected-range-end="isHistoricalYear ? null : form.end || null"
              :min-selectable-iso="minIso"
              :read-only="isHistoricalYear"
              :reservation-control-override="isHistoricalYear ? null : reservationControlOverride"
              :reservation-cap-blocked-months="isHistoricalYear ? [] : reservationCapBlockedMonths"
              @day-click="onCalendarDayClick"
              @day-hover="onCalendarDayHover"
              @reservation-month-click="openReservationDialog"
              @reservation-cap-blocked="openReservationCapNotice"
            />
            <p v-else class="vac-emp-empty">
              Нет записи в справочнике сотрудников для вашего аккаунта. Попросите HR добавить вас в справочник с
              вашим email.
            </p>
          </section>
        </div>
        <VacationCalendarScopeToggle
          v-if="hasTeamCalendar"
          :model-value="calendarScope"
          @update:model-value="setCalendarScope"
        />
      </div>

      <EmployeeVacationAside
        v-if="!embedded"
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
import { assessVacationBalance } from '~/utils/vacationBalance';
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
  RESERVATION_CAP_DEPARTMENT_BLOCKED_MESSAGE
} from '~/utils/vacationReservationCaps';
import {
  findGroupLeadVacationOverlaps,
  GROUP_LEAD_OVERLAP_BADGE_LABEL,
  GROUP_LEAD_OVERLAP_BLOCKED_MESSAGE,
  GROUP_LEAD_OVERLAP_POPOVER_TITLE
} from '~/utils/vacationGroupLeadOverlap';
import {
  needsTwoStepApproval,
  resolveVacationApprovalPath,
  type VacationApprovalPathSeg
} from '~/utils/vacationApproval';

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
  hydrate: hydrateEmployees
} = useEmployees();
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
const displayRequests = computed(() => mergeRequestsForDisplay(props.viewYear, yearRequests.value));
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

/** Только текущий учётный год и прошлый (без «будущего» 2027+). */
const yearOptions = computed(() => {
  const primary = state.value.primaryYear;
  return [primary, primary - 1].filter((year) => year > 0);
});

watch(
  yearOptions,
  (years) => {
    if (!years.length || years.includes(props.viewYear)) return;
    emit('update:viewYear', years[0]!);
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
      context: {
        department: {
          id: ctx.department.id,
          label: ctx.department.label,
          memberNames: ctx.department.members.map((member) => member.name)
        },
        subgroup: {
          id: ctx.subgroup.id,
          label: ctx.subgroup.label,
          memberNames: ctx.subgroup.members.map((member) => member.name)
        }
      },
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
    employeesInDepartment
  });
});

const reservationCapBlockedMonths = computed(() => {
  const ctx = reservationCapContext.value;
  if (!ctx) return [] as number[];
  const blocked: number[] = [];
  const caps = state.value.reservationMonthlyCapsByGroup;
  const reservations = allReservations.value;
  const capContext = {
    department: {
      id: ctx.department.id,
      label: ctx.department.label,
      memberNames: ctx.department.members.map((member) => member.name)
    },
    subgroup: {
      id: ctx.subgroup.id,
      label: ctx.subgroup.label,
      memberNames: ctx.subgroup.members.map((member) => member.name)
    }
  };
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    if (
      getReservationMonthBlockReason({
        context: capContext,
        year: props.viewYear,
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
});

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

const formAssessment = computed(() => {
  const y = state.value.primaryYear;
  const byId = new Map<number, VacationRequest>();
  for (const yr of [y - 1, y, y + 1]) {
    for (const req of requestsForYear(yr)) {
      byId.set(req.id, req);
    }
  }
  return assessVacationBalance(
    employeeName.value,
    hireIso.value,
    form.start,
    form.end,
    [...byId.values()],
    y,
    undefined,
    currentEmployee.value?.vacation_opening_balance
  );
});

const form = reactive({ start: '', end: '' });
const formError = ref<{ title: string; text: string } | null>(null);
const submitting = ref(false);

type RequestCreatedToast = {
  route: string;
  note: string;
  path: VacationApprovalPathSeg[];
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
  const path = resolveVacationApprovalPath(
    { status: 'pending', approval_step: twoStep ? 'manager' : 'director' },
    emp ?? null
  );
  requestCreatedToast.value = {
    route: twoStep
      ? 'Она ушла группхеду. После него — директор отдела.'
      : 'Она ушла руководителю на согласование.',
    note: REQUEST_CREATED_NOTE,
    path
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
    allRequests: requestsForYear(state.value.primaryYear)
  });
});

const blockedDays = computed(() => {
  if (!employeeName.value) return new Set<string>();
  const { approved, pending } = buildDaySetsForEmployee(
    employeeName.value,
    props.viewYear,
    displayRequests.value
  );
  return new Set([...approved, ...pending]);
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

const onCalendarDayClick = (...args: Parameters<typeof handleDayClick>) => {
  if (isHistoricalYear.value) return;
  handleDayClick(...args);
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
});

watch(
  () => props.viewYear,
  () => {
    clearSelection();
    form.start = '';
    form.end = '';
    formError.value = null;
    clarifyHint.value = '';
    dismissRequestCreatedToast();
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
    const capReason = getReservationRangeBlockReason({
      context: {
        department: {
          id: capCtx.department.id,
          label: capCtx.department.label,
          memberNames: capCtx.department.members.map((member) => member.name)
        },
        subgroup: {
          id: capCtx.subgroup.id,
          label: capCtx.subgroup.label,
          memberNames: capCtx.subgroup.members.map((member) => member.name)
        }
      },
      start: form.start,
      end: form.end,
      reservations: allReservations.value,
      requests: capRequests.value,
      caps: state.value.reservationMonthlyCapsByGroup,
      excludeEmployee: employeeName.value
    });
    if (capReason) {
      formError.value = {
        title: 'Месяц занят в группе',
        text: reservationCapBlockMessage(capReason)
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
});

onBeforeUnmount(() => {
  if (!import.meta.client) return;
  window.removeEventListener('resize', fitTeamTableToSideTabs);
});

watch(
  [showTeamCalendar, () => teamDepartments.value.map((d) => d.employees.length).join(',')],
  () => {
    void fitTeamTableToSideTabs();
  }
);
</script>
