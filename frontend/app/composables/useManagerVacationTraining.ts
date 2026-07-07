import { MANAGER_VACATION_TRAINING_STEPS } from '~/data/vacationTrainingQuest';

const STORAGE_KEY = 'vbi-manager-vacation-training-v1';

type TrainingStorage = {
  completed: number[];
  skipped: number[];
};

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

export const isManagerVacationTrainingCompleted = (userId: number): boolean =>
  readStorage().completed.includes(userId);

export function useManagerVacationTraining() {
  const { user } = useAuth();
  const runtimeConfig = useRuntimeConfig();
  const { isManager, isHr } = usePermissions();
  const isEnabled = computed(() => runtimeConfig.public.vacationTrainingEnabled === true);

  const isActive = useState<boolean>('manager-vac-training-active', () => false);
  const stepIndex = useState<number>('manager-vac-training-step-index', () => 0);
  const promptDismissed = useState<boolean>('manager-vac-training-prompt-dismissed', () => false);

  const steps = MANAGER_VACATION_TRAINING_STEPS;

  const currentStep = computed(() => {
    if (!isActive.value) return null;
    return steps[stepIndex.value] ?? null;
  });

  const totalSteps = computed(() => steps.length);

  const progressLabel = computed(() =>
    isActive.value ? `Квест ${Math.min(stepIndex.value + 1, totalSteps.value)} из ${totalSteps.value}` : ''
  );

  const canShowForRole = computed(() => isManager.value || isHr.value);

  const shouldShowPrompt = computed(() => {
    if (!isEnabled.value || !canShowForRole.value) return false;
    const id = user.value?.id;
    if (!id || !import.meta.client) return false;
    if (isActive.value || promptDismissed.value) return false;
    const storage = readStorage();
    return !storage.completed.includes(id) && !storage.skipped.includes(id);
  });

  const startTraining = () => {
    if (!user.value?.id) return;
    isActive.value = true;
    stepIndex.value = 0;
    promptDismissed.value = true;
  };

  const skipTraining = () => {
    const id = user.value?.id;
    if (!id) return;
    const storage = readStorage();
    if (!storage.skipped.includes(id)) storage.skipped.push(id);
    writeStorage(storage);
    isActive.value = false;
    stepIndex.value = 0;
    promptDismissed.value = true;
  };

  const finishTraining = () => {
    const id = user.value?.id;
    if (!id) return;
    const storage = readStorage();
    if (!storage.completed.includes(id)) storage.completed.push(id);
    writeStorage(storage);
    isActive.value = false;
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

  const completeCurrentStep = () => {
    goNextStep();
  };

  const notifyApprovalTabOpened = () => {
    if (!isActive.value || currentStep.value?.action !== 'open-approval-tab') return;
    goNextStep();
  };

  return {
    isEnabled,
    isActive,
    currentStep,
    stepIndex,
    totalSteps,
    progressLabel,
    shouldShowPrompt,
    startTraining,
    skipTraining,
    finishTraining,
    goPrevStep,
    completeCurrentStep,
    notifyApprovalTabOpened
  };
}
