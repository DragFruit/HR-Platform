import type { VacationRequest } from '~/composables/useVacations';
import {
  EMPLOYEE_VACATION_TRAINING_STEPS,
  type VacationTrainingStep
} from '~/data/vacationTrainingQuest';

export type TrainingVacationRequest = VacationRequest & { isTraining: true };

const STORAGE_KEY = 'vbi-vacation-training-v1';

type TrainingStorage = {
  completed: number[];
  skipped: number[];
};

let trainingRequestSeq = -1000;

const readStorage = (): TrainingStorage => {
  if (!import.meta.client) return { completed: [], skipped: [] };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { completed: [], skipped: [] };
  try {
    const parsed = JSON.parse(raw) as TrainingStorage;
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      skipped: Array.isArray(parsed.skipped) ? parsed.skipped : []
    };
  } catch {
    return { completed: [], skipped: [] };
  }
};

const writeStorage = (data: TrainingStorage) => {
  if (!import.meta.client) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export function useVacationTraining() {
  const { user } = useAuth();
  const runtimeConfig = useRuntimeConfig();
  const isEnabled = computed(() => runtimeConfig.public.vacationTrainingEnabled === true);

  const isActive = useState<boolean>('vac-training-active', () => false);
  const stepIndex = useState<number>('vac-training-step-index', () => 0);
  const trainingRequests = useState<TrainingVacationRequest[]>('vac-training-requests', () => []);
  const promptDismissed = useState<boolean>('vac-training-prompt-dismissed', () => false);

  const steps = EMPLOYEE_VACATION_TRAINING_STEPS;

  const currentStep = computed<VacationTrainingStep | null>(() => {
    if (!isActive.value) return null;
    return steps[stepIndex.value] ?? null;
  });

  const totalSteps = computed(() => steps.length);

  const progressLabel = computed(() => {
    if (!isActive.value) return '';
    return `Квест ${Math.min(stepIndex.value + 1, totalSteps.value)} из ${totalSteps.value}`;
  });

  const isCompletedForUser = (userId: number) => readStorage().completed.includes(userId);
  const isSkippedForUser = (userId: number) => readStorage().skipped.includes(userId);

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
    return [...real, ...training];
  };

  const startTraining = () => {
    const id = user.value?.id;
    if (!id) return;
    isActive.value = true;
    stepIndex.value = 0;
    trainingRequests.value = [];
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
    promptDismissed.value = true;
    isActive.value = false;
    trainingRequests.value = [];
    stepIndex.value = 0;
  };

  const exitTraining = () => {
    isActive.value = false;
    trainingRequests.value = [];
    stepIndex.value = 0;
  };

  const finishTraining = () => {
    const id = user.value?.id;
    if (!id) return;
    const store = readStorage();
    if (!store.completed.includes(id)) {
      store.completed.push(id);
      writeStorage(store);
    }
    isActive.value = false;
    trainingRequests.value = [];
    stepIndex.value = 0;
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

  const resetTrainingProgress = () => {
    const id = user.value?.id;
    if (!id || !import.meta.client) return;
    const store = readStorage();
    store.completed = store.completed.filter((x) => x !== id);
    store.skipped = store.skipped.filter((x) => x !== id);
    writeStorage(store);
    promptDismissed.value = false;
    isActive.value = false;
    trainingRequests.value = [];
    stepIndex.value = 0;
  };

  return {
    isEnabled,
    isActive,
    currentStep,
    stepIndex,
    totalSteps,
    progressLabel,
    shouldShowPrompt,
    trainingRequests,
    startTraining,
    skipTraining,
    exitTraining,
    finishTraining,
    acknowledgeStep,
    goPrevStep,
    notifyCalendarRangeSelected,
    addTrainingRequest,
    mergeRequestsForDisplay,
    trainingRequestsForViewYear,
    resetTrainingProgress
  };
}
