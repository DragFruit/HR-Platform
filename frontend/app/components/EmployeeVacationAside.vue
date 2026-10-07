<template>
  <div
    class="employee-aside-shell"
    :class="{
      'employee-aside-shell--embedded': embedded,
      'employee-aside-shell--training-locked': !embedded && isTrainingActive
    }"
  >
    <aside
      class="employee-aside"
      :class="{
        'employee-aside--fit': !embedded,
        'employee-aside--embedded': embedded,
        'employee-aside--training-locked': !embedded && isTrainingActive
      }"
    >
    <VacationUiModeToggle
      v-if="uiMode !== undefined"
      :model-value="uiMode"
      :team-mode-label="teamModeLabel ?? 'Руководитель'"
      @update:model-value="(mode) => emit('update:uiMode', mode)"
    />

    <div class="emp-balance-card" data-tour="vac-balance">
      <div class="emp-balance-card-label">Доступно дней отпуска</div>
      <div class="emp-balance-figures emp-balance-figures-single">
        <span class="emp-balance-big">{{ balance.remain }}</span>
      </div>
    </div>

    <details class="emp-projection-details" data-tour="vac-projection">
      <summary class="emp-projection-summary">Рассчитать доступные дни к дате</summary>
      <div class="emp-projection-panel">
        <label class="emp-projection-label">
          Дата
          <input
            v-model="projectionDate"
            type="date"
            class="emp-projection-date"
            :min="projectionMinDate"
          />
        </label>
        <button type="button" class="vac-btn emp-projection-btn" @click="showProjection">Показать</button>
        <div v-if="projectionText" class="emp-projection-result">
          <template v-if="projectionDays != null">
            К {{ projectionLabel }} доступно
            <span class="emp-projection-days-accent">{{ projectionDays }}</span> дней.
          </template>
          <template v-else>{{ projectionText }}</template>
        </div>
      </div>
    </details>

    <table class="mini-table employee-mini-stat">
      <thead>
        <tr>
          <th>Тип отпуска</th>
          <th>Отгулял</th>
          <th>План</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Ежегодный</td>
          <td>{{ balance.taken }}</td>
          <td>{{ balance.planned }}</td>
        </tr>
      </tbody>
    </table>

    <section
      v-if="myReservations.length"
      class="emp-reservations-block"
      data-tour="vac-reservations-block"
    >
      <h4 class="emp-requests-heading">Предварительные брони</h4>
      <div class="emp-reservations-list">
        <div
          v-for="res in myReservations"
          :key="res.id"
          class="emp-reservation-row"
          :class="{ 'emp-reservation-row--training': isTrainingReservationItem(res) }"
        >
          <div class="emp-reservation-row__main">
            <span class="emp-reservation-period">{{ formatReservationRow(res) }}</span>
            <span v-if="isTrainingReservationItem(res)" class="vac-training-tag">Учебная</span>
            <span v-if="res.comment" class="emp-reservation-comment">{{ res.comment }}</span>
          </div>
          <div class="emp-reservation-row__actions">
            <button
              v-if="canManageReservation(res)"
              type="button"
              class="vac-emp-btn vac-emp-btn--ghost vac-emp-btn--sm"
              data-tour="vac-reservation-clarify"
              :disabled="isCreateRequestFromReservationDisabled"
              :title="
                isCreateRequestFromReservationDisabled
                  ? 'Будет доступно после завершения обучения'
                  : undefined
              "
              @click="emitClarify(res)"
            >
              Создать заявку
            </button>
            <button
              v-if="!isTrainingReservationItem(res) && canManageReservation(res)"
              type="button"
              class="vac-emp-btn vac-emp-btn--ghost vac-emp-btn--sm emp-reservation-delete"
              @click="removeReservation(res.id)"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="emp-requests-block" data-tour="vac-my-requests">
      <h4 class="emp-requests-heading">Мои заявки</h4>
      <div class="emp-requests-list">
        <p v-if="!employeeName" class="emp-requests-empty">Профиль не привязан к справочнику.</p>
        <p v-else-if="myRequests.length === 0" class="emp-requests-empty">Заявок пока нет.</p>
        <div v-for="req in myRequests" :key="req.id" class="emp-request-row" :class="{ 'emp-request-row--training': isTrainingRequest(req) }">
          <div class="emp-request-row__top">
            <div class="emp-request-main">
              <span class="emp-request-period">
                <span class="emp-request-period__dates">{{ formatRequestDates(req) }}</span
                ><span class="emp-request-period__days"> ({{ requestPeriodDays(req) }} дн.)</span>
              </span>
              <div class="emp-request-meta">
                <div
                  class="emp-request-path"
                  :class="`emp-request-path--${req.status}`"
                  :aria-label="statusLabel(req)"
                >
                  <span
                    v-for="seg in approvalPath(req)"
                    :key="`${req.id}-${seg.label}`"
                    class="emp-request-path__seg"
                    :class="`is-${seg.state}`"
                  >
                    {{ seg.label }}
                  </span>
                </div>
                <span v-if="isTrainingRequest(req)" class="vac-training-tag">Учебная</span>
                <span
                  v-if="req.status === 'pending' && requestAdvance(req).status === 'advance'"
                  class="vac-advance-tag"
                >
                  Не хватает {{ requestAdvance(req).deficit }} дн.
                </span>
              </div>
            </div>
            <p v-if="applicationDownloadErrorFor === req.id" class="emp-request-download-error">
              {{ applicationDownloadError }}
            </p>
            <div v-if="canOpenRequestMenu(req)" class="emp-request-menu-wrap">
              <button
                type="button"
                class="emp-request-menu-btn"
                aria-label="Действия с заявкой"
                aria-haspopup="menu"
                :aria-expanded="openMenuRequest?.id === req.id"
                @click.stop="toggleRequestMenu(req, $event)"
              >
                ⋯
              </button>
            </div>
          </div>

          <div v-if="editingId === req.id" class="emp-request-edit">
            <label class="emp-request-edit__field">
              <span>с</span>
              <input
                v-model="editForm.start"
                type="date"
                class="vac-emp-input"
                :min="allowPastDates ? undefined : todayMinIso"
              />
            </label>
            <label class="emp-request-edit__field">
              <span>по</span>
              <input
                v-model="editForm.end"
                type="date"
                class="vac-emp-input"
                :min="allowPastDates ? undefined : todayMinIso"
              />
            </label>
            <div class="emp-request-edit__actions">
              <button type="button" class="vac-emp-btn vac-emp-btn--ghost" @click="cancelEditRequest">
                Отмена
              </button>
              <button type="button" class="vac-emp-btn" @click="saveEditRequest(req.id)">Сохранить</button>
            </div>
            <p v-if="editError" class="emp-request-edit__error">{{ editError }}</p>
          </div>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="openMenuRequest"
        ref="menuRef"
        class="emp-request-menu emp-request-menu--teleported"
        role="menu"
        :style="{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }"
        @click.stop
      >
        <button
          v-if="canDownloadVacationApplication(openMenuRequest)"
          type="button"
          class="emp-request-menu-item emp-request-menu-item--download"
          role="menuitem"
          :disabled="downloadingApplicationId === openMenuRequest.id"
          :aria-busy="downloadingApplicationId === openMenuRequest.id"
          @click="downloadVacationApplication(openMenuRequest)"
        >
          {{ downloadingApplicationId === openMenuRequest.id ? 'Скачиваем…' : 'Скачать заявление' }}
        </button>
        <button
          v-if="canManageRequest(openMenuRequest)"
          type="button"
          class="emp-request-menu-item"
          role="menuitem"
          @click="startEditRequest(openMenuRequest)"
        >
          Изменить даты
        </button>
        <button
          v-if="canManageRequest(openMenuRequest)"
          type="button"
          class="emp-request-menu-item emp-request-menu-item--danger"
          role="menuitem"
          @click="removeRequest(openMenuRequest)"
        >
          Удалить
        </button>
      </div>
    </Teleport>

    <VacationTrainingPrompt v-if="!embedded" />

    <h4 class="employee-legend-title">Легенда</h4>
    <div class="hr-legend-item"><span class="hr-legend-swatch sw-weekend" /> Выходной день</div>
    <div class="hr-legend-item"><span class="hr-legend-swatch sw-holiday" /> Праздничный день</div>
    <div class="hr-legend-item"><span class="hr-legend-swatch sw-approved" /> Отпуск (одобрен)</div>
    <div class="hr-legend-item"><span class="hr-legend-swatch sw-pending" /> На согласовании</div>
    <div class="hr-legend-item"><span class="hr-legend-swatch sw-reservation" /> Предварительная бронь</div>
    </aside>

    <VacationTrainingHelpButton v-if="!embedded" />
  </div>
</template>

<script setup lang="ts">
import { calcAvailableOnDate, calcEmployeeBalance, assessVacationBalance } from '~/utils/vacationBalance';
import { countVacationBillableDays, isPastApprovedVacationRequest, isVacationStartInPast, todayIso, toIso } from '~/utils/vacationCalendar';
import type { VacationRequest } from '~/composables/useVacations';
import type { TrainingVacationRequest, TrainingVacationReservation } from '~/composables/useVacationTraining';
import {
  canManageReservationMonth,
  formatReservationPeriod,
  type VacationReservation
} from '~/utils/vacationReservations';
import { isLaborContractEmployee } from '~/data/employeeDirectoryOptions';
import { vacationBelongsToEmployee } from '~/utils/vacationEmployeeRef';
import { resolveVacationApprovalPath } from '~/utils/vacationApproval';

const props = defineProps<{
  viewYear: number;
  embedded?: boolean;
  uiMode?: 'manager' | 'employee';
  teamModeLabel?: string;
}>();

const emit = defineEmits<{
  'update:uiMode': [value: 'manager' | 'employee'];
  'clarify-reservation': [reservation: VacationReservation];
}>();

const { user } = useAuth();
const { isAdmin } = usePermissions();
const allowPastDates = computed(() => isAdmin.value);
const todayMinIso = todayIso();
const { findByUserForAuth } = useEmployees();
const {
  requestsForYear,
  employeeRequests,
  employeeReservations,
  updateRequestDates,
  deleteRequest,
  deleteReservation,
  requestStatusLabel,
  state,
  MONTHS_RU
} = useVacations();
const {
  mergeRequestsForDisplay,
  mergeReservationsForDisplay,
  isTrainingReservation,
  isActive: isTrainingActive
} = useVacationTraining();

const isCreateRequestFromReservationDisabled = computed(() => isTrainingActive.value);

const isTrainingReservationItem = (res: VacationReservation): res is TrainingVacationReservation =>
  'isTraining' in res && Boolean((res as TrainingVacationReservation).isTraining);

const isTrainingRequest = (req: VacationRequest): req is TrainingVacationRequest =>
  'isTraining' in req && Boolean((req as TrainingVacationRequest).isTraining);

const canManageRequest = (req: VacationRequest) =>
  !isTrainingRequest(req) && !isPastApprovedVacationRequest(req);

const canDownloadVacationApplication = (req: VacationRequest) =>
  !isTrainingRequest(req) &&
  req.status === 'approved' &&
  isLaborContractEmployee(currentEmployee.value?.contract_form) &&
  req.start > todayIso();

const canOpenRequestMenu = (req: VacationRequest) =>
  canManageRequest(req) || canDownloadVacationApplication(req);

const projectionDate = ref('');
const projectionText = ref('');
const projectionDays = ref<number | null>(null);
const projectionLabel = ref('');
/** Расчёт к дате — только будущие дни (не сегодня и не прошлое). */
const projectionMinDate = computed(() => {
  const tomorrow = new Date();
  tomorrow.setHours(12, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toIso(tomorrow);
});
const openMenuRequest = ref<VacationRequest | null>(null);
const menuAnchorRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const menuOpen = computed(() => openMenuRequest.value !== null);

const { position: menuPosition, updatePosition: updateMenuPosition } = useFloatingPosition(
  menuAnchorRef,
  menuRef,
  menuOpen,
  { placement: 'bottom-end', offset: 4 }
);
const editingId = ref<number | null>(null);
const editForm = reactive({ start: '', end: '' });
const editError = ref('');

const currentEmployee = computed(() => findByUserForAuth(user.value));
const employeeName = computed(() => currentEmployee.value?.name ?? '');
const employeeId = computed(() => currentEmployee.value?.id ?? null);
const hireIso = computed(() => currentEmployee.value?.hired_at ?? '');
const openingBalance = computed(() => currentEmployee.value?.vacation_opening_balance ?? null);

/** Цифры и списки aside всегда по текущему учётном году, даже если календарь смотрит прошлый. */
const balanceYear = computed(() => state.value.primaryYear);

/** Заявки соседних лет: отпуск через НГ лежит в папке года начала. */
const balanceYearRequests = computed(() => {
  const y = balanceYear.value;
  const byId = new Map<number, VacationRequest>();
  for (const yr of [y - 1, y, y + 1]) {
    for (const req of requestsForYear(yr)) {
      byId.set(req.id, req);
    }
  }
  return [...byId.values()];
});

const yearRequests = computed(() =>
  mergeRequestsForDisplay(balanceYear.value, requestsForYear(balanceYear.value))
);

const myReservations = computed(() => {
  if (!employeeName.value) return [];
  const real = employeeReservations(employeeName.value, balanceYear.value, employeeId.value);
  const merged = mergeReservationsForDisplay(balanceYear.value, real);
  return merged
    .filter((r) => vacationBelongsToEmployee(r, { id: employeeId.value, name: employeeName.value }))
    .sort((a, b) => a.month - b.month);
});

const formatReservationRow = (res: VacationReservation) =>
  formatReservationPeriod(res.year, res.month, res.durationDays, MONTHS_RU);

const canManageReservation = (res: VacationReservation) =>
  isTrainingReservationItem(res) || canManageReservationMonth(res.year, res.month);

const emitClarify = (res: VacationReservation) => {
  if (isCreateRequestFromReservationDisabled.value) return;
  emit('clarify-reservation', res);
};

const removeReservation = async (id: number) => {
  if (isTrainingReservation(id)) return;
  await deleteReservation(id);
};

const myRequests = computed(() => {
  if (!employeeName.value) return [];
  const real = employeeRequests(employeeName.value, balanceYear.value, employeeId.value);
  const merged = mergeRequestsForDisplay(balanceYear.value, real);
  return merged
    .filter((r) => vacationBelongsToEmployee(r, { id: employeeId.value, name: employeeName.value }))
    .sort((a, b) => {
      const aTraining = isTrainingRequest(a);
      const bTraining = isTrainingRequest(b);
      if (aTraining !== bTraining) return aTraining ? -1 : 1;
      return b.id - a.id;
    });
});

const balance = computed(() =>
  calcEmployeeBalance(
    employeeName.value,
    hireIso.value,
    balanceYearRequests.value,
    new Date(),
    balanceYear.value,
    openingBalance.value
  )
);

const statusLabel = (req: VacationRequest) =>
  requestStatusLabel(req, currentEmployee.value ?? undefined);

const approvalPath = (req: VacationRequest) =>
  resolveVacationApprovalPath(req, currentEmployee.value ?? null);

const downloadingApplicationId = ref<number | null>(null);
const applicationDownloadError = ref('');
const applicationDownloadErrorFor = ref<number | null>(null);

const setDownloadError = (reqId: number, text: string) => {
  applicationDownloadError.value = text;
  applicationDownloadErrorFor.value = reqId;
};

const downloadVacationApplication = async (req: VacationRequest) => {
  if (downloadingApplicationId.value === req.id) return;
  closeRequestMenu();
  downloadingApplicationId.value = req.id;
  applicationDownloadError.value = '';
  applicationDownloadErrorFor.value = null;
  const fail = (text = 'Не удалось скачать заявление') => setDownloadError(req.id, text);

  try {
    const response = await fetch(`/api/vacations/requests/${req.id}/application`, {
      credentials: 'include'
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        statusMessage?: string;
        message?: string;
      } | null;
      const text = (payload?.statusMessage || payload?.message || '').trim();
      fail(
        text && text.length <= 180 && !/Multi error|Docxtemplater|at Object\.|statusCode|stack/i.test(text)
          ? text
          : 'Не удалось скачать заявление'
      );
      return;
    }
    const type = response.headers.get('Content-Type') || '';
    if (!type.includes('officedocument') && !type.includes('octet-stream')) {
      fail();
      return;
    }
    const cd = response.headers.get('Content-Disposition') || '';
    const encoded = cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plain = cd.match(/filename="([^"]+)"/i)?.[1];
    const filename =
      (encoded ? decodeURIComponent(encoded) : plain) || `Заявление_на_отпуск_${req.start}.docx`;
    const url = URL.createObjectURL(await response.blob());
    const link = Object.assign(document.createElement('a'), {
      href: url,
      download: filename,
      rel: 'noopener'
    });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    fail();
  } finally {
    downloadingApplicationId.value = null;
  }
};

const formatRequestDates = (req: VacationRequest) => {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${String(y).slice(-2)}`;
  };
  return `${fmt(req.start)} - ${fmt(req.end)}`;
};

const requestPeriodDays = (req: VacationRequest) => countVacationBillableDays(req.start, req.end);

const requestAdvance = (req: VacationRequest) =>
  assessVacationBalance(
    employeeName.value,
    hireIso.value,
    req.start,
    req.end,
    balanceYearRequests.value,
    balanceYear.value,
    req.id,
    openingBalance.value
  );

const hasConflict = (start: string, end: string, excludeId?: number) =>
  yearRequests.value.some(
    (r) =>
      r.id !== excludeId &&
      vacationBelongsToEmployee(r, { id: employeeId.value, name: employeeName.value }) &&
      (r.status === 'approved' || r.status === 'pending') &&
      !(end < r.start || start > r.end)
  );

const closeRequestMenu = () => {
  openMenuRequest.value = null;
  menuAnchorRef.value = null;
};

const toggleRequestMenu = (req: VacationRequest, event: MouseEvent) => {
  if (!canOpenRequestMenu(req)) return;
  if (openMenuRequest.value?.id === req.id) {
    closeRequestMenu();
    return;
  }
  menuAnchorRef.value = event.currentTarget as HTMLElement;
  openMenuRequest.value = req;
  editingId.value = null;
  editError.value = '';
  updateMenuPosition();
};

useDismissOnEscape(menuOpen, closeRequestMenu);

const startEditRequest = (req: VacationRequest) => {
  if (!canManageRequest(req)) return;
  editingId.value = req.id;
  editForm.start = req.start;
  editForm.end = req.end;
  editError.value = '';
  closeRequestMenu();
};

const cancelEditRequest = () => {
  editingId.value = null;
  editError.value = '';
};

const saveEditRequest = async (id: number) => {
  editError.value = '';
  if (!editForm.start || !editForm.end) {
    editError.value = 'Укажите обе даты.';
    return;
  }
  if (editForm.end < editForm.start) {
    editError.value = 'Дата окончания не может быть раньше начала.';
    return;
  }
  if (!allowPastDates.value && isVacationStartInPast(editForm.start, todayIso())) {
    editError.value = 'Нельзя оформить отпуск задним числом.';
    return;
  }
  if (hasConflict(editForm.start, editForm.end, id)) {
    editError.value = 'Пересечение с другим отпуском.';
    return;
  }
  if (await updateRequestDates(id, editForm.start, editForm.end)) {
    editingId.value = null;
  } else {
    editError.value = 'Не удалось сохранить.';
  }
};

const removeRequest = async (req: VacationRequest) => {
  if (!canManageRequest(req)) return;
  closeRequestMenu();
  if (editingId.value === req.id) cancelEditRequest();
  await deleteRequest(req.id);
};

const showProjection = () => {
  projectionDays.value = null;
  projectionLabel.value = '';
  if (!employeeName.value || !hireIso.value) {
    projectionText.value = 'Нет даты приёма.';
    return;
  }
  if (!projectionDate.value) {
    projectionText.value = 'Укажите дату.';
    return;
  }
  if (projectionDate.value < projectionMinDate.value) {
    projectionText.value = 'Укажите дату начиная с завтрашнего дня.';
    return;
  }
  const available = calcAvailableOnDate(
    employeeName.value,
    hireIso.value,
    projectionDate.value,
    balanceYearRequests.value,
    balanceYear.value,
    openingBalance.value
  );
  if (available == null) {
    projectionText.value = 'Раньше даты приёма.';
    return;
  }
  const [, m, d] = projectionDate.value.split('-');
  projectionLabel.value = `${d}.${m}`;
  projectionDays.value = available;
  projectionText.value = 'ok';
};

const onDocumentClick = (event: MouseEvent) => {
  const target = event.target as Node;
  if (menuRef.value?.contains(target) || menuAnchorRef.value?.contains(target)) return;
  closeRequestMenu();
};

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
});
</script>
