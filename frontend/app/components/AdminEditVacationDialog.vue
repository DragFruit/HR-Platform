<template>
  <Teleport to="body">
    <div
      v-if="open && request"
      class="org-confirm-overlay vac-admin-add-overlay"
      role="presentation"
      @click.self="close"
    >
      <form
        class="vac-admin-add-card card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vac-admin-edit-title"
        @submit.prevent="submit"
      >
        <h3 id="vac-admin-edit-title" class="vac-admin-add-title">Изменить отпуск</h3>
        <p class="vac-admin-add-hint">
          <strong class="vac-admin-edit__who">{{ request.employee }}</strong>
          · {{ statusText }}. Статус не меняется<template v-if="request.status === 'approved'">,
            отметка в графике отсутствий Битрикса обновится</template>.
        </p>

        <div class="vac-admin-add-dates">
          <label class="vac-admin-add-field">
            <span class="vac-admin-add-label">С</span>
            <input v-model="form.start" type="date" class="vac-emp-input vac-admin-add-input" required />
          </label>
          <label class="vac-admin-add-field">
            <span class="vac-admin-add-label">По</span>
            <input v-model="form.end" type="date" class="vac-emp-input vac-admin-add-input" required />
          </label>
        </div>

        <label class="vac-admin-add-field">
          <span class="vac-admin-add-label">Комментарий</span>
          <input
            v-model="form.comment"
            type="text"
            class="vac-emp-input vac-admin-add-input"
            :maxlength="VACATION_COMMENT_MAX_LENGTH"
          />
        </label>

        <p v-if="formError" class="vac-admin-add-error" role="alert">{{ formError }}</p>
        <template v-else>
          <p v-if="overlapText" class="vac-admin-add-warn" role="status">{{ overlapText }}</p>
          <p v-if="shortfall.shortfall > 0" class="vac-admin-add-warn" role="status">
            {{ shortfallWarning }}
          </p>
        </template>

        <p v-if="lastEdit" class="vac-admin-edit__last">Последняя правка: {{ lastEdit }}</p>

        <div class="vac-admin-add-actions row">
          <button type="button" class="button ghost" :disabled="submitting" @click="close">
            Отмена
          </button>
          <button type="submit" class="button primary" :disabled="submitting || !dirty">
            {{ submitting ? 'Сохранение…' : 'Сохранить' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { VacationRequest } from '~/composables/useVacations';
import { VACATION_COMMENT_MAX_LENGTH, validateVacationEditDates } from '~/utils/vacationAdminEdit';
import { vacationBookingYearError, requestsAroundYear } from '~/utils/vacationBookingYears';
import {
  countOverlapPeople,
  findRequestOverlaps,
  resolveOverlapScope
} from '~/utils/vacationOverlaps';
import {
  assessVacationShortfall,
  formatVacationDaysAmount,
  vacationDaysGenitive
} from '~/utils/vacationShortfall';

const props = defineProps<{
  open: boolean;
  request: VacationRequest | null;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  saved: [];
}>();

const { employees, findByName } = useEmployees();
const { adminEditRequest, requestStatusLabel, state } = useVacations();

const form = reactive({ start: '', end: '', comment: '' });
const formError = ref('');
const submitting = ref(false);

const fillForm = () => {
  form.start = props.request?.start ?? '';
  form.end = props.request?.end ?? '';
  form.comment = props.request?.comment ?? '';
  formError.value = '';
};

watch(
  () => [props.open, props.request?.id] as const,
  ([isOpen]) => {
    if (isOpen) fillForm();
  },
  { immediate: true }
);

const statusText = computed(() =>
  props.request ? requestStatusLabel(props.request, findByName(props.request.employee)) : ''
);

const dirty = computed(
  () =>
    Boolean(props.request) &&
    (form.start !== props.request!.start ||
      form.end !== props.request!.end ||
      form.comment.trim() !== (props.request!.comment ?? '').trim())
);

const datesValid = computed(() => !validateVacationEditDates(form.start, form.end));

/** Пересечения с коллегами отдела — только предупреждение, сохранять не мешает. */
const overlapText = computed(() => {
  const req = props.request;
  if (!req || !datesValid.value) return '';
  const scope = resolveOverlapScope({
    mode: 'requester-department',
    requesterName: req.employee,
    employees: employees.value
  });
  const pool = requestsAroundYear(state.value.requestsByYear, Number(form.start.slice(0, 4)));
  const entries = findRequestOverlaps({ ...req, start: form.start, end: form.end }, pool, scope);
  if (!entries.length) return '';
  const names = [...new Set(entries.map((e) => e.employee))];
  const people = countOverlapPeople(entries);
  return `Пересекается с отпусками отдела (${people}): ${names.slice(0, 4).join(', ')}${
    names.length > 4 ? '…' : ''
  }.`;
});

const shortfall = computed(() => {
  const req = props.request;
  if (!req || !datesValid.value) return { shortfall: 0 };
  const emp = findByName(req.employee);
  return assessVacationShortfall({
    employeeName: req.employee,
    hireIso: emp?.hired_at,
    start: form.start,
    end: form.end,
    requests: Object.values(state.value.requestsByYear).flat(),
    primaryYear: state.value.primaryYear,
    excludeRequestId: req.id,
    openingBalance: emp?.vacation_opening_balance
  });
});

const shortfallWarning = computed(() => {
  const n = shortfall.value.shortfall;
  return `Не хватает ${formatVacationDaysAmount(n)} ${vacationDaysGenitive(n)} отпуска. Сохранить можно как исключение.`;
});

const lastEdit = computed(() => {
  const edits = props.request?.admin_edits;
  const last = edits?.length ? edits[edits.length - 1] : null;
  if (!last) return '';
  const at = new Date(last.at);
  const when = Number.isNaN(at.getTime()) ? '' : `${at.toLocaleDateString('ru-RU')}, `;
  return `${when}${last.summary}`;
});

const close = () => {
  if (submitting.value) return;
  emit('update:open', false);
};

const submit = async () => {
  const req = props.request;
  if (!req) return;
  formError.value =
    validateVacationEditDates(form.start, form.end) ||
    vacationBookingYearError(form.start, form.end, state.value.primaryYear, req.start) ||
    '';
  if (formError.value) return;

  submitting.value = true;
  try {
    await adminEditRequest(req.id, {
      start: form.start,
      end: form.end,
      comment: form.comment.trim()
    });
    emit('saved');
    emit('update:open', false);
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string; message?: string };
    formError.value =
      err.data?.statusMessage || err.statusMessage || err.message || 'Ошибка сохранения. Попробуйте ещё раз.';
  } finally {
    submitting.value = false;
  }
};

</script>

<style scoped>
.vac-admin-edit__who {
  color: var(--text);
}

.vac-admin-edit__last {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
}
</style>
