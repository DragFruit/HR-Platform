export type AdaptationPhaseId = 'pre_start' | 'day_1' | 'week_1' | 'month_1' | 'probation_90';

export type StepOwner = 'employee' | 'manager' | 'buddy' | 'hr';

export type AdaptationStepTemplate = {
  id: string;
  title: string;
  due_day: number;
  owner: StepOwner;
};

export type QuizQuestionType = 'single' | 'multi' | 'scale';

export type QuizQuestion = {
  id: string;
  type: QuizQuestionType;
  text: string;
  options?: { id: string; label: string }[];
  correct?: string | string[];
  scale_min?: number;
  scale_max?: number;
};

export type AdaptationQuizTemplate = {
  id: string;
  phase: AdaptationPhaseId;
  title: string;
  passing_score: number;
  questions: QuizQuestion[];
};

export type AdaptationPhaseTemplate = {
  id: AdaptationPhaseId;
  title: string;
  description: string;
  due_day_from: number;
  due_day_to: number;
  steps: AdaptationStepTemplate[];
  quiz: AdaptationQuizTemplate | null;
};

export type AdaptationTrackTemplate = {
  id: string;
  title: string;
  phases: AdaptationPhaseTemplate[];
};

export type AdaptationAnswer = {
  question_id: string;
  value: string | string[] | number;
};

export type AdaptationAttempt = {
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

export type StepCompletion = {
  step_id: string;
  employee_id: number;
  completed_at: string;
  completed_by_user_id: number;
};

export type AdaptationStoreState = {
  attempts: AdaptationAttempt[];
  step_completions: StepCompletion[];
};
