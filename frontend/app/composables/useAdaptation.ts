export type AdaptationPhaseId = 'pre_start' | 'day_1' | 'week_1' | 'month_1' | 'probation_90';

export type AdaptationAnswer = {
  question_id: string;
  value: string | string[] | number;
};

export type QuizQuestionClient = {
  id: string;
  type: 'single' | 'multi' | 'scale';
  text: string;
  options?: { id: string; label: string }[];
  scale_min?: number;
  scale_max?: number;
};

export type AdaptationQuizClient = {
  id: string;
  phase: AdaptationPhaseId;
  title: string;
  passing_score: number;
  questions: QuizQuestionClient[];
};

export type AdaptationPhaseClient = {
  id: AdaptationPhaseId;
  title: string;
  description: string;
  due_day_from: number;
  due_day_to: number;
  steps: {
    id: string;
    title: string;
    due_day: number;
    owner: string;
    completed?: boolean;
  }[];
  quiz: AdaptationQuizClient | null;
  unlocked?: boolean;
  overdue?: boolean;
  quiz_passed?: boolean;
  quiz_score?: number | null;
};

export type AdaptationAttemptRecord = {
  id: string;
  employee_id: number;
  employee_name: string;
  platform_user_id: number;
  quiz_id: string;
  phase: AdaptationPhaseId;
  quiz_title: string;
  answers: AdaptationAnswer[];
  score_percent: number;
  passed: boolean;
  submitted_at: string;
  admin_seen: boolean;
};

export type AdaptationMeResponse = {
  employee: {
    id: number;
    name: string;
    title: string;
    department: string;
    manager: string;
    hired_at: string;
    platform_user_id: number | null;
  } | null;
  track: {
    id: string;
    title: string;
    phases: AdaptationPhaseClient[];
  };
  days_since_hire: number | null;
  attempts: AdaptationAttemptRecord[];
  step_completions: { step_id: string; employee_id: number; completed_at: string }[];
  progress_percent: number;
};

const phaseLabels: Record<AdaptationPhaseId, string> = {
  pre_start: 'До выхода',
  day_1: 'День 1',
  week_1: 'Неделя 1',
  month_1: '30 дней',
  probation_90: '90 дней'
};

export function useAdaptation() {
  const me = useState<AdaptationMeResponse | null>('adaptation-me', () => null);
  const adminAttempts = useState<AdaptationAttemptRecord[]>('adaptation-admin-attempts', () => []);
  const unseenCount = useState<number>('adaptation-unseen-count', () => 0);
  const loading = useState<boolean>('adaptation-loading', () => false);
  const error = useState<string | null>('adaptation-error', () => null);

  const loadMe = async () => {
    loading.value = true;
    error.value = null;
    try {
      me.value = await $fetch<AdaptationMeResponse>('/api/adaptation/me');
    } catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string }; message?: string };
      error.value = err.data?.statusMessage ?? err.message ?? 'Ошибка загрузки';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const submitAttempt = async (quizId: string, answers: AdaptationAnswer[]) => {
    const result = await $fetch<{
      attempt: AdaptationAttemptRecord;
      passed: boolean;
      score_percent: number;
      passing_score: number;
    }>('/api/adaptation/attempts', {
      method: 'POST',
      body: { quiz_id: quizId, answers }
    });
    await loadMe();
    return result;
  };

  const completeStep = async (stepId: string) => {
    await $fetch(`/api/adaptation/steps/${stepId}`, { method: 'PATCH' });
    await loadMe();
  };

  const loadAdminAttempts = async (filters?: { unseen?: boolean; phase?: string }) => {
    loading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      if (filters?.unseen) params.set('unseen', '1');
      if (filters?.phase) params.set('phase', filters.phase);
      const qs = params.toString();
      const data = await $fetch<{ attempts: AdaptationAttemptRecord[]; unseen_count: number }>(
        `/api/adaptation/attempts${qs ? `?${qs}` : ''}`
      );
      adminAttempts.value = data.attempts;
      unseenCount.value = data.unseen_count;
    } catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string }; message?: string };
      error.value = err.data?.statusMessage ?? err.message ?? 'Ошибка загрузки';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const markSeen = async (attemptId: string) => {
    await $fetch(`/api/adaptation/attempts/${attemptId}/seen`, { method: 'PATCH' });
    await loadAdminAttempts();
  };

  const resetUserSession = () => {
    me.value = null;
    error.value = null;
    loading.value = false;
  };

  const getPhaseLabel = (phase: AdaptationPhaseId) => phaseLabels[phase] ?? phase;

  return {
    me,
    adminAttempts,
    unseenCount,
    loading,
    error,
    loadMe,
    submitAttempt,
    completeStep,
    loadAdminAttempts,
    markSeen,
    resetUserSession,
    getPhaseLabel,
    phaseLabels
  };
}
