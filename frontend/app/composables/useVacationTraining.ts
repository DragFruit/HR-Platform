import type { VacationRequest } from '~/composables/useVacations';
import type { VacationReservation } from '~/utils/vacationReservations';
import { isManagerVacationTrainingCompleted } from '~/composables/useManagerVacationTraining';
import {
  EMPLOYEE_VACATION_TRAINING_STEPS,
  VACATION_TRAINING_RESERVATION_MONTH,
  type VacationTrainingStep
} from '~/data/vacationTrainingQuest';

export type TrainingVacationRequest = VacationRequest & { isTraining: true };
export type TrainingVacationReservation = VacationReservation & { isTraining: true };

const STORAGE_KEY = 'vbi-vacation-training-v1';

type TrainingStorage = {
  completed: number[];
  skipped: number[];
  /** userId → ISO-дата завершения (для ленты активности). */
  completedAt?: Record<string, string>;
};

let trainingRequestSeq = -1000;
let trainingReservationSeq = -2000;

const readStorage = (): TrainingStorage => {
  if (!import.meta.client) return { completed: [], skipped: [], completedAt: {} };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { completed: [], skipped: [], completedAt: {} };
  try {
    const parsed = JSON.parse(raw) as TrainingStorage;
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      skipped: Array.isArray(parsed.skipped) ? parsed.skipped : [],
      completedAt:
        parsed.completedAt && typeof parsed.completedAt === 'object' ? parsed.completedAt : {}
    };
  } catch {
    return { completed: [], skipped: [], completedAt: {} };
  }
};

const writeStorage = (data: TrainingStorage) => {
  if (!import.meta.client) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const isEmployeeVacationTrainingCompleted = (userId: number): boolean =>
  readStorage().completed.includes(userId);

export function useVacationTraining() {
  const { user } = useAuth();
  const { isManager, isHr } = usePermissions();
  const runtimeConfig = useRuntimeConfig();
  const isEnabled = computed(() => runtimeConfig.public.vacationTrainingEnabled === true);

  const isActive = useState<boolean>('vac-training-active', () => false);
  const stepIndex = useState<number>('vac-training-step-index', () => 0);
  const trainingRequests = useState<TrainingVacationRequest[]>('vac-training-requests', () => []);
  const trainingReservations = useState<TrainingVacationReservation[]>(
    'vac-training-reservations',
    () => []
  );
  const promptDismissed = useState<boolean>('vac-training-prompt-dismissed', () => false);
  const isRetakeMode = useState<boolean>('vac-training-retake', () => false);
  const storageRevision = useState<number>('vac-training-storage-revision', () => 0);

  const bumpStorageRevision = () => {
    storageRevision.value += 1;
  };

  const steps = EMPLOYEE_VACATION_TRAINING_STEPS;

  const currentStep = computed<VacationTrainingStep | null>(() => {
    if (!isActive.value) return null;
    return steps[stepIndex.value] ?? null;
  });

  const totalSteps = computed(() => steps.length);

  const progressLabel = computed(() => {
    if (!isActive.value) return '';
    const step = Math.min(stepIndex.value + 1, totalSteps.value);
    return `квест. Шаг ${step} из ${totalSteps.value}`;
  });

  const isCompletedForUser = (userId: number) => {
    storageRevision.value;
    return readStorage().completed.includes(userId);
  };
  const isSkippedForUser = (userId: number) => {
    storageRevision.value;
    return readStorage().skipped.includes(userId);
  };

  const isCompletedForCurrentUser = computed(() => {
    const id = user.value?.id;
    return id ? isCompletedForUser(id) : false;
  });

  const shouldShowHelpButton = computed(() => {
    if (!isEnabled.value || !import.meta.client) return false;
    const id = user.value?.id;
    if (!id || isActive.value) return false;
    return isCompletedForUser(id) || isSkippedForUser(id);
  });

  const shouldShowPrompt = computed(() => {
    if (!isEnabled.value) return false;
    const id = user.value?.id;
    if (!id || !import.meta.client) return false;
    if (isActive.value || promptDismissed.value) return false;
    if (isCompletedForUser(id) || isSkippedForUser(id)) return false;
    return true;
  });

  const trainingRequestsForViewYear = (year: number) =>
    trainingRequests.value.filter((req) => {
      const startYear = Number(req.start.slice(0, 4));
      const endYear = Number(req.end.slice(0, 4));
      return startYear <= year && endYear >= year;
    });

  const mergeRequestsForDisplay = (year: number, real: VacationRequest[]) => {
    if (!isActive.value && trainingRequests.value.length === 0) return real;
    const training = trainingRequestsForViewYear(year);
    if (!training.length) return real;
    return [...training, ...real];
  };

  const trainingReservationsForViewYear = (year: number) =>
    trainingReservations.value.filter((item) => item.year === year);

  const mergeReservationsForDisplay = (year: number, real: VacationReservation[]) => {
    if (!isActive.value && trainingReservations.value.length === 0) return real;
    const training = trainingReservationsForViewYear(year);
    if (!training.length) return real;
    const withoutTrainingMonth = real.filter(
      (item) => !training.some((t) => t.month === item.month && t.employee === item.employee)
    );
    return [...withoutTrainingMonth, ...training];
  };

  const isTrainingReservation = (id: number) =>
    trainingReservations.value.some((item) => item.id === id);

  const startTraining = () => {
    const id = user.value?.id;
    if (!id) return;
    isRetakeMode.value = false;
    isActive.value = true;
    stepIndex.value = 0;
    trainingRequests.value = [];
    trainingReservations.value = [];
    promptDismissed.value = true;
  };

  const restartTraining = () => {
    const id = user.value?.id;
    if (!id) return;
    const completed = isCompletedForUser(id);
    const skipped = isSkippedForUser(id);
    if (!completed && !skipped) return;

    // Повтор без награды — только если квест уже был пройден до конца.
    isRetakeMode.value = completed;

    if (skipped && !completed) {
      const store = readStorage();
      store.skipped = store.skipped.filter((x) => x !== id);
      writeStorage(store);
      bumpStorageRevision();
    }

    isActive.value = true;
    stepIndex.value = 0;
    trainingRequests.value = [];
    trainingReservations.value = [];
    promptDismissed.value = true;
  };

  const skipTraining = () => {
    const id = user.value?.id;
    if (!id) return;
    const store = readStorage();
    if (!store.skipped.includes(id)) {
      store.skipped.push(id);
      writeStorage(store);
    }
    bumpStorageRevision();
    promptDismissed.value = true;
    isActive.value = false;
    trainingRequests.value = [];
    trainingReservations.value = [];
    stepIndex.value = 0;
  };

  const exitTraining = () => {
    isActive.value = false;
    isRetakeMode.value = false;
    trainingRequests.value = [];
    trainingReservations.value = [];
    stepIndex.value = 0;
  };

  const finishTraining = () => {
    const id = user.value?.id;
    if (!id) return;
    if (!isRetakeMode.value) {
      const store = readStorage();
      if (!store.completed.includes(id)) {
        store.completed.push(id);
        store.completedAt = store.completedAt ?? {};
        store.completedAt[String(id)] = new Date().toISOString();
        writeStorage(store);
      }
      bumpStorageRevision();
    }
    exitTraining();
  };

  const goNextStep = () => {
    if (!isActive.value) return;
    if (stepIndex.value >= steps.length - 1) {
      finishTraining();
      return;
    }
    stepIndex.value += 1;
  };

  const goPrevStep = () => {
    if (!isActive.value || stepIndex.value <= 0) return;
    stepIndex.value -= 1;
  };

  const acknowledgeStep = () => {
    const step = currentStep.value;
    if (!step || step.action !== 'acknowledge') return;
    goNextStep();
  };

  const notifyCalendarRangeSelected = () => {
    if (!isActive.value || currentStep.value?.id !== 'calendar') return;
    goNextStep();
  };

  const addTrainingRequest = (payload: { employee: string; start: string; end: string }) => {
    if (!isActive.value || currentStep.value?.id !== 'create') return null;

    const request: TrainingVacationRequest = {
      id: trainingRequestSeq--,
      employee: payload.employee,
      start: payload.start,
      end: payload.end,
      status: 'pending',
      comment: 'Учебная заявка (квест)',
      createdAt: new Date().toLocaleDateString('ru-RU'),
      isTraining: true
    };

    trainingRequests.value = [...trainingRequests.value, request];
    goNextStep();
    return request;
  };

  const addTrainingReservation = (payload: {
    employee: string;
    year: number;
    month: number;
    durationDays: number;
    comment?: string;
  }) => {
    if (!isActive.value) return null;

    const onBookStep = currentStep.value?.id === 'reservation-book';
    const existing = trainingReservations.value.find(
      (item) =>
        item.employee === payload.employee &&
        item.year === payload.year &&
        item.month === payload.month
    );

    if (existing) {
      const updated: TrainingVacationReservation = {
        ...existing,
        durationDays: payload.durationDays,
        comment: payload.comment
      };
      trainingReservations.value = trainingReservations.value.map((item) =>
        item.id === existing.id ? updated : item
      );
      if (onBookStep) goNextStep();
      return updated;
    }

    if (!onBookStep) return null;

    const reservation: TrainingVacationReservation = {
      id: trainingReservationSeq--,
      employee: payload.employee,
      year: payload.year,
      month: payload.month,
      durationDays: payload.durationDays,
      comment: payload.comment,
      createdAt: new Date().toLocaleDateString('ru-RU'),
      isTraining: true
    };

    trainingReservations.value = [...trainingReservations.value, reservation];
    goNextStep();
    return reservation;
  };

  const resetTrainingProgress = () => {
    const id = user.value?.id;
    if (!id || !import.meta.client) return;
    const store = readStorage();
    store.completed = store.completed.filter((x) => x !== id);
    store.skipped = store.skipped.filter((x) => x !== id);
    writeStorage(store);
    bumpStorageRevision();
    promptDismissed.value = false;
    isRetakeMode.value = false;
    isActive.value = false;
    trainingRequests.value = [];
    trainingReservations.value = [];
    stepIndex.value = 0;
  };

  const canClaimVacationAchievement = () => {
    const id = user.value?.id;
    if (!id) return false;
    if (!isManager.value && !isHr.value) return true;
    return isManagerVacationTrainingCompleted(id);
  };

  return {
    isEnabled,
    isActive,
    isRetakeMode,
    currentStep,
    stepIndex,
    totalSteps,
    progressLabel,
    shouldShowPrompt,
    shouldShowHelpButton,
    isCompletedForCurrentUser,
    trainingRequests,
    trainingReservations,
    startTraining,
    restartTraining,
    skipTraining,
    exitTraining,
    finishTraining,
    acknowledgeStep,
    goPrevStep,
    notifyCalendarRangeSelected,
    addTrainingRequest,
    addTrainingReservation,
    mergeRequestsForDisplay,
    mergeReservationsForDisplay,
    isTrainingReservation,
    trainingReservationsForViewYear,
    trainingRequestsForViewYear,
    resetTrainingProgress,
    canClaimVacationAchievement,
    trainingReservationMonth: VACATION_TRAINING_RESERVATION_MONTH
  };
}
