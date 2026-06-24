<template>
  <aside class="employee-aside employee-aside--fit" :class="{ 'employee-aside--embedded': embedded }">
    <div class="emp-balance-card">
      <div class="emp-balance-card-label">Доступно дней отпуска</div>
      <div class="emp-balance-figures emp-balance-figures-single">
        <span class="emp-balance-big">{{ balance.remain }}</span>
      </div>
    </div>

    <details class="emp-projection-details">
      <summary class="emp-projection-summary">Рассчитать доступные дни к дате</summary>
      <div class="emp-projection-panel">
        <label class="emp-projection-label">
          Дата
          <input v-model="projectionDate" type="date" class="emp-projection-date" />
        </label>
        <button type="button" class="vac-btn emp-projection-btn" @click="showProjection">Показать</button>
        <div v-if="projectionText" class="emp-projection-result" v-html="projectionText" />
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

    <section class="emp-requests-block">
      <h4 class="emp-requests-heading">Мои заявки</h4>
      <div class="emp-requests-list">
        <p v-if="!employeeName" class="emp-requests-empty">Профиль не привязан к справочнику.</p>
        <p v-else-if="myRequests.length === 0" class="emp-requests-empty">Заявок пока нет.</p>
        <div v-for="req in myRequests" :key="req.id" class="emp-request-row">
          <div class="emp-request-row__top">
            <div class="emp-request-main">
              <span class="emp-request-period">{{ formatRequestPeriod(req) }}</span>
              <div class="emp-request-meta">
                <span class="pill" :class="req.status">{{ statusLabel(req.status) }}</span>
                <span
                  v-if="req.status === 'pending' && requestAdvance(req).status === 'advance'"
                  class="vac-advance-tag"
                >
                  Аванс {{ requestAdvance(req).deficit }} дн.
                </span>
              </div>
            </div>
            <div class="emp-request-menu-wrap">
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
              <input v-model="editForm.start" type="date" class="vac-emp-input" />
            </label>
            <label class="emp-request-edit__field">
              <span>по</span>
              <input v-model="editForm.end" type="date" class="vac-emp-input" />
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
        <button type="button" class="emp-request-menu-item" role="menuitem" @click="startEditRequest(openMenuRequest)">
          Изменить даты
        </button>
        <button
          type="button"
          class="emp-request-menu-item emp-request-menu-item--danger"
          role="menuitem"
          @click="removeRequest(openMenuRequest)"
        >
          Удалить
        </button>
      </div>
    </Teleport>

    <h4 class="employee-legend-title">Легенда</h4>
    <div class="hr-legend-item"><span class="hr-legend-swatch sw-weekend" /> Выходной день</div>
    <div class="hr-legend-item"><span class="hr-legend-swatch sw-holiday" /> Праздничный день</div>
    <div class="hr-legend-item"><span class="hr-legend-swatch sw-approved" /> Отпуск (одобрен)</div>
    <div class="hr-legend-item"><span class="hr-legend-swatch sw-pending" /> На согласовании</div>
  </aside>
</template>

<script setup lang="ts">
import { calcAvailableOnDate, calcEmployeeBalance, assessVacationBalance } from '~/utils/vacationBalance';
import { countVacationBillableDays } from '~/utils/vacationCalendar';
import type { VacationRequest, VacationStatus } from '~/composables/useVacations';

const props = defineProps<{
  viewYear: number;
  embedded?: boolean;
}>();

const { user } = useAuth();
const { findByUserForAuth } = useEmployees();
const {
  requestsForYear,
  employeeRequests,
  updateRequestDates,
  deleteRequest,
  vacationStatusLabels,
  state
} = useVacations();

const yearRequests = computed(() => requestsForYear(props.viewYear));

const projectionDate = ref('');
const projectionText = ref('');
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
const hireIso = computed(() => currentEmployee.value?.hired_at ?? '');

const myRequests = computed(() => {
  if (!employeeName.value) return [];
  return [...employeeRequests(employeeName.value, props.viewYear)].sort((a, b) =>
    a.start.localeCompare(b.start)
  );
});

const balance = computed(() =>
  calcEmployeeBalance(employeeName.value, hireIso.value, yearRequests.value, new Date(), props.viewYear)
);

const statusLabel = (status: VacationStatus) => vacationStatusLabels[status];

const formatRequestPeriod = (req: VacationRequest) => {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  };
  const days = countVacationBillableDays(req.start, req.end);
  return `${fmt(req.start)} — ${fmt(req.end)} (${days} дн.)`;
};

const requestAdvance = (req: VacationRequest) =>
  assessVacationBalance(
    employeeName.value,
    hireIso.value,
    req.start,
    req.end,
    yearRequests.value,
    state.value.primaryYear,
    req.id
  );

const hasConflict = (start: string, end: string, excludeId?: number) =>
  yearRequests.value.some(
    (r) =>
      r.id !== excludeId &&
      r.employee === employeeName.value &&
      (r.status === 'approved' || r.status === 'pending') &&
      !(end < r.start || start > r.end)
  );

const closeRequestMenu = () => {
  openMenuRequest.value = null;
  menuAnchorRef.value = null;
};

const toggleRequestMenu = (req: VacationRequest, event: MouseEvent) => {
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

const saveEditRequest = (id: number) => {
  editError.value = '';
  if (!editForm.start || !editForm.end) {
    editError.value = 'Укажите обе даты.';
    return;
  }
  if (editForm.end < editForm.start) {
    editError.value = 'Дата окончания не может быть раньше начала.';
    return;
  }
  if (hasConflict(editForm.start, editForm.end, id)) {
    editError.value = 'Пересечение с другим отпуском.';
    return;
  }
  if (updateRequestDates(id, editForm.start, editForm.end)) {
    editingId.value = null;
  } else {
    editError.value = 'Не удалось сохранить.';
  }
};

const removeRequest = (req: VacationRequest) => {
  closeRequestMenu();
  if (editingId.value === req.id) cancelEditRequest();
  deleteRequest(req.id);
};

const showProjection = () => {
  if (!employeeName.value || !hireIso.value) {
    projectionText.value = 'Нет даты приёма.';
    return;
  }
  if (!projectionDate.value) {
    projectionText.value = 'Укажите дату.';
    return;
  }
  const available = calcAvailableOnDate(
    employeeName.value,
    hireIso.value,
    projectionDate.value,
    yearRequests.value,
    state.value.primaryYear
  );
  if (available == null) {
    projectionText.value = 'Раньше даты приёма.';
    return;
  }
  const [, m, d] = projectionDate.value.split('-');
  projectionText.value = `К ${d}.${m} доступно <span class="emp-projection-days-accent">${available}</span> дней.`;
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
