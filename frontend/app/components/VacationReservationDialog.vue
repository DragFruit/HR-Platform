<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="org-confirm-overlay vac-reservation-overlay"
      role="presentation"
      @click.self="close"
    >
      <form
        class="vac-reservation-card card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vac-reservation-title"
        @submit.prevent="submit"
      >
        <h3 id="vac-reservation-title" class="vac-reservation-title">
          {{ isEditMode ? 'Изменить бронь' : 'Предварительная бронь' }}
        </h3>
        <p class="vac-reservation-hint">
          {{ monthLabel }} {{ year }} — точные даты уточню позже.
        </p>

        <fieldset class="vac-reservation-presets">
          <legend class="vac-reservation-label">Длительность</legend>
          <div class="vac-reservation-preset-row">
            <button
              v-for="preset in RESERVATION_DURATION_PRESETS"
              :key="preset.days"
              type="button"
              class="vac-reservation-preset-btn"
              :class="{ active: durationMode === 'preset' && durationDays === preset.days }"
              @click="selectPreset(preset.days)"
            >
              {{ preset.label }}
            </button>
          </div>
        </fieldset>

        <label class="vac-reservation-field">
          <span class="vac-reservation-label">Другое количество дней</span>
          <input
            v-model.number="customDays"
            type="number"
            class="vac-emp-input vac-reservation-input"
            :min="RESERVATION_MIN_DAYS"
            :max="RESERVATION_MAX_DAYS"
            step="1"
            @focus="durationMode = 'custom'"
          />
        </label>

        <label class="vac-reservation-field">
          <span class="vac-reservation-label">Комментарий (необязательно)</span>
          <input
            v-model="comment"
            type="text"
            class="vac-emp-input vac-reservation-input"
            maxlength="200"
            placeholder="Например: после проекта"
          />
        </label>

        <p v-if="formError" class="vac-reservation-error" role="alert">{{ formError }}</p>

        <div class="vac-reservation-actions row">
          <button type="button" class="button ghost" :disabled="submitting" @click="close">
            Отмена
          </button>
          <button type="submit" class="button primary" :disabled="submitting">
            {{ submitting ? 'Сохранение…' : isEditMode ? 'Сохранить' : 'Забронировать' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {
  RESERVATION_DURATION_PRESETS,
  RESERVATION_MAX_DAYS,
  RESERVATION_MIN_DAYS,
  isValidReservationDuration,
  type VacationReservation
} from '~/utils/vacationReservations';

const props = defineProps<{
  open: boolean;
  year: number;
  /** 0–11 */
  monthIndex: number;
  monthLabel: string;
  employeeName: string;
  editingReservation?: VacationReservation | null;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  saved: [];
}>();

const { addReservation, updateReservation } = useVacations();
const { isActive: isTrainingActive, currentStep: trainingStep, addTrainingReservation, isTrainingReservation } =
  useVacationTraining();

const durationMode = ref<'preset' | 'custom'>('preset');
const durationDays = ref(7);
const customDays = ref<number | null>(null);
const comment = ref('');
const formError = ref('');
const submitting = ref(false);

const isEditMode = computed(() => Boolean(props.editingReservation));

const resetForm = () => {
  durationMode.value = 'preset';
  durationDays.value = 7;
  customDays.value = null;
  comment.value = '';
  formError.value = '';
};

const fillFromReservation = (reservation: VacationReservation) => {
  const preset = RESERVATION_DURATION_PRESETS.find((p) => p.days === reservation.durationDays);
  if (preset) {
    durationMode.value = 'preset';
    durationDays.value = preset.days;
    customDays.value = null;
  } else {
    durationMode.value = 'custom';
    customDays.value = reservation.durationDays;
    durationDays.value = 7;
  }
  comment.value = reservation.comment ?? '';
  formError.value = '';
};

const selectPreset = (days: number) => {
  durationMode.value = 'preset';
  durationDays.value = days;
  customDays.value = null;
};

const resolvedDuration = () => {
  if (durationMode.value === 'custom' && customDays.value != null) {
    return customDays.value;
  }
  return durationDays.value;
};

const close = () => {
  emit('update:open', false);
  resetForm();
};

watch(
  () => [props.open, props.editingReservation?.id] as const,
  ([isOpen]) => {
    if (!isOpen) {
      resetForm();
      return;
    }
    if (props.editingReservation) {
      fillFromReservation(props.editingReservation);
    } else {
      resetForm();
    }
  }
);

const submit = async () => {
  formError.value = '';
  const days = resolvedDuration();
  if (!isValidReservationDuration(days)) {
    formError.value = `Укажите от ${RESERVATION_MIN_DAYS} до ${RESERVATION_MAX_DAYS} дней.`;
    return;
  }
  if (!props.employeeName) {
    formError.value = 'Профиль не привязан к справочнику.';
    return;
  }

  submitting.value = true;
  try {
    const commentValue = comment.value.trim() || undefined;
    const month = props.monthIndex + 1;

    if (isTrainingActive.value) {
      const trainingId = props.editingReservation?.id;
      if (
        trainingStep.value?.id === 'reservation-book' ||
        (trainingId !== undefined && isTrainingReservation(trainingId))
      ) {
        addTrainingReservation({
          year: props.year,
          month,
          durationDays: days,
          employee: props.employeeName,
          comment: commentValue
        });
        emit('saved');
        close();
        return;
      }
    }

    if (props.editingReservation) {
      const updated = await updateReservation(props.editingReservation.id, {
        durationDays: days,
        comment: commentValue ?? ''
      });
      if (!updated) {
        formError.value = 'Не удалось сохранить изменения.';
        return;
      }
    } else {
      await addReservation({
        year: props.year,
        month: props.monthIndex + 1,
        durationDays: days,
        employee: props.employeeName,
        comment: commentValue
      });
    }
    emit('saved');
    close();
  } catch (err: unknown) {
    const message =
      err && typeof err === 'object' && 'statusMessage' in err
        ? String((err as { statusMessage?: string }).statusMessage)
        : 'Не удалось сохранить бронь.';
    formError.value = message;
  } finally {
    submitting.value = false;
  }
};
</script>
