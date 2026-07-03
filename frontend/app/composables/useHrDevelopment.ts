export type CompetencyLevel = 0 | 1 | 2 | 3 | 4;

export type HrCompetency = {
  id: string;
  name: string;
  description: string;
  category: string;
};

export type HrGrade = {
  id: string;
  title: string;
  shortLabel: string;
  order: number;
};

export type HrGradeExpectation = {
  gradeId: string;
  competencyId: string;
  level: CompetencyLevel;
};

export type HrAssessmentSnapshot = {
  roleTitle: string;
  currentGradeId: string;
  targetGradeId: string;
  selfRatings: Record<string, CompetencyLevel>;
  lastReviewDate: string;
};

export type IdpGoal = {
  id: string;
  title: string;
  competencyId: string;
  gapFrom: CompetencyLevel;
  gapTo: CompetencyLevel;
  dueDate: string;
  status: 'planned' | 'in_progress' | 'done';
};

export type IdpActivity = {
  id: string;
  goalId: string;
  bucket: '70' | '20' | '10';
  title: string;
  detail: string;
  done: boolean;
};

export type IdpCheckpoint = {
  id: string;
  date: string;
  title: string;
  note: string;
  status: 'upcoming' | 'done';
};

const HR_COMPETENCIES: HrCompetency[] = [
  {
    id: 'recruitment',
    name: 'Подбор персонала',
    description: 'Воронка, интервью, офферы, работа с hiring-менеджерами',
    category: 'HR-операции'
  },
  {
    id: 'assessment',
    name: 'Оценка персонала',
    description: 'Performance review, калибровки, обратная связь',
    category: 'HR-операции'
  },
  {
    id: 'labor-law',
    name: 'Трудовое право',
    description: 'Кадровые процедуры, ТК РФ, риски и документооборот',
    category: 'Комплаенс'
  },
  {
    id: 'communications',
    name: 'Коммуникации',
    description: 'Фасилитация, переговоры, работа со стейкхолдерами',
    category: 'Soft skills'
  },
  {
    id: 'hr-analytics',
    name: 'Аналитика HR',
    description: 'Метрики, дашборды, People data, гипотезы',
    category: 'Аналитика'
  },
  {
    id: 'onboarding',
    name: 'Адаптация и развитие',
    description: 'Онбординг, ИПР, программы обучения',
    category: 'Развитие'
  },
  {
    id: 'culture',
    name: 'Культура и вовлечённость',
    description: 'Опросы, EVP, внутренние коммуникации',
    category: 'Развитие'
  },
  {
    id: 'hr-tech',
    name: 'HR-tech и процессы',
    description: 'HRM-системы, автоматизация, регламенты',
    category: 'Операции'
  }
];

const HR_GRADES: HrGrade[] = [
  { id: 'junior', title: 'Junior HR', shortLabel: 'Junior', order: 1 },
  { id: 'middle', title: 'Middle HR', shortLabel: 'Middle', order: 2 },
  { id: 'senior', title: 'Senior HR', shortLabel: 'Senior', order: 3 }
];

const HR_EXPECTATIONS: HrGradeExpectation[] = [
  { gradeId: 'junior', competencyId: 'recruitment', level: 2 },
  { gradeId: 'junior', competencyId: 'assessment', level: 1 },
  { gradeId: 'junior', competencyId: 'labor-law', level: 2 },
  { gradeId: 'junior', competencyId: 'communications', level: 2 },
  { gradeId: 'junior', competencyId: 'hr-analytics', level: 1 },
  { gradeId: 'junior', competencyId: 'onboarding', level: 2 },
  { gradeId: 'junior', competencyId: 'culture', level: 1 },
  { gradeId: 'junior', competencyId: 'hr-tech', level: 1 },

  { gradeId: 'middle', competencyId: 'recruitment', level: 3 },
  { gradeId: 'middle', competencyId: 'assessment', level: 3 },
  { gradeId: 'middle', competencyId: 'labor-law', level: 3 },
  { gradeId: 'middle', competencyId: 'communications', level: 3 },
  { gradeId: 'middle', competencyId: 'hr-analytics', level: 2 },
  { gradeId: 'middle', competencyId: 'onboarding', level: 3 },
  { gradeId: 'middle', competencyId: 'culture', level: 2 },
  { gradeId: 'middle', competencyId: 'hr-tech', level: 2 },

  { gradeId: 'senior', competencyId: 'recruitment', level: 4 },
  { gradeId: 'senior', competencyId: 'assessment', level: 4 },
  { gradeId: 'senior', competencyId: 'labor-law', level: 4 },
  { gradeId: 'senior', competencyId: 'communications', level: 4 },
  { gradeId: 'senior', competencyId: 'hr-analytics', level: 4 },
  { gradeId: 'senior', competencyId: 'onboarding', level: 4 },
  { gradeId: 'senior', competencyId: 'culture', level: 3 },
  { gradeId: 'senior', competencyId: 'hr-tech', level: 3 }
];

const HR_ASSESSMENT: HrAssessmentSnapshot = {
  roleTitle: 'HR Generalist (шаблон)',
  currentGradeId: 'junior',
  targetGradeId: 'middle',
  lastReviewDate: '2026-03-15',
  selfRatings: {
    recruitment: 2,
    assessment: 1,
    'labor-law': 2,
    communications: 3,
    'hr-analytics': 1,
    onboarding: 2,
    culture: 2,
    'hr-tech': 1
  }
};

const HR_IDP_GOALS: IdpGoal[] = [
  {
    id: 'goal-assessment',
    title: 'Провести цикл performance review',
    competencyId: 'assessment',
    gapFrom: 1,
    gapTo: 3,
    dueDate: '2026-08-30',
    status: 'in_progress'
  },
  {
    id: 'goal-analytics',
    title: 'Собрать дашборд HR-метрик',
    competencyId: 'hr-analytics',
    gapFrom: 1,
    gapTo: 2,
    dueDate: '2026-07-15',
    status: 'in_progress'
  },
  {
    id: 'goal-hrtech',
    title: 'Автоматизировать заявки в HRM',
    competencyId: 'hr-tech',
    gapFrom: 1,
    gapTo: 2,
    dueDate: '2026-09-30',
    status: 'planned'
  }
];

const HR_IDP_ACTIVITIES: IdpActivity[] = [
  {
    id: 'act-70-1',
    goalId: 'goal-assessment',
    bucket: '70',
    title: 'Сопроводить 2 review-цикла под наставничеством',
    detail: 'Взять 2 направления, подготовить формы и сводку для калибровки',
    done: false
  },
  {
    id: 'act-20-1',
    goalId: 'goal-assessment',
    bucket: '20',
    title: 'Еженедельные разборы с Senior HR',
    detail: '30 мин: кейсы оценки, обратная связь, типовые ошибки',
    done: true
  },
  {
    id: 'act-10-1',
    goalId: 'goal-assessment',
    bucket: '10',
    title: 'Курс «Современная оценка персонала»',
    detail: 'ITMO Skills · 12 часов · сертификат',
    done: false
  },
  {
    id: 'act-70-2',
    goalId: 'goal-analytics',
    bucket: '70',
    title: 'Собрать отчёт по текучести и time-to-hire',
    detail: 'Данные из HRM + презентация для HRD',
    done: false
  },
  {
    id: 'act-20-2',
    goalId: 'goal-analytics',
    bucket: '20',
    title: 'Менторство от аналитика People Team',
    detail: 'Парная работа над SQL-запросами и визуализацией',
    done: false
  },
  {
    id: 'act-10-2',
    goalId: 'goal-analytics',
    bucket: '10',
    title: 'Воркшоп по HR-аналитике',
    detail: 'Внутренний митап VBI · 3 часа',
    done: true
  },
  {
    id: 'act-70-3',
    goalId: 'goal-hrtech',
    bucket: '70',
    title: 'Пилот заявок на отпуск в HRM',
    detail: 'Настроить маршрут согласования для одного отдела',
    done: false
  },
  {
    id: 'act-10-3',
    goalId: 'goal-hrtech',
    bucket: '10',
    title: 'Документация по API HRM',
    detail: 'Изучить интеграции и чек-лист внедрения',
    done: false
  }
];

const HR_IDP_CHECKPOINTS: IdpCheckpoint[] = [
  {
    id: 'cp-1',
    date: '2026-04-01',
    title: 'Старт ИПР',
    note: 'Согласованы цели и связь с матрицей компетенций',
    status: 'done'
  },
  {
    id: 'cp-2',
    date: '2026-06-15',
    title: 'Промежуточный review',
    note: 'Проверка прогресса по оценке персонала и аналитике',
    status: 'upcoming'
  },
  {
    id: 'cp-3',
    date: '2026-09-30',
    title: 'Итоговая калибровка',
    note: 'Пересмотр грейда и обновление матрицы',
    status: 'upcoming'
  }
];

export const competencyLevelLabels: Record<CompetencyLevel, string> = {
  0: '—',
  1: 'Базовый',
  2: 'Уверенный',
  3: 'Продвинутый',
  4: 'Эксперт'
};

export const idpBucketLabels: Record<IdpActivity['bucket'], string> = {
  '70': '70% — практика',
  '20': '20% — наставничество',
  '10': '10% — обучение'
};

export function useHrDevelopment() {
  const { hydrate: hydrateTest, hasResults, competencyLevels, radarScores, result: testResult } =
    useHrKnowledgeTest();

  if (import.meta.client) {
    hydrateTest();
  }

  const competencies = HR_COMPETENCIES;
  const grades = HR_GRADES;
  const expectations = HR_EXPECTATIONS;
  const assessmentBase = HR_ASSESSMENT;
  const idpGoals = HR_IDP_GOALS;
  const idpActivities = HR_IDP_ACTIVITIES;
  const idpCheckpoints = HR_IDP_CHECKPOINTS;

  const assessment = computed(() => {
    if (!hasResults.value) return assessmentBase;
    return {
      ...assessmentBase,
      lastReviewDate: testResult.value?.completedAt ?? assessmentBase.lastReviewDate,
      selfRatings: { ...competencyLevels.value }
    };
  });

  const expectationFor = (gradeId: string, competencyId: string): CompetencyLevel => {
    return expectations.find((e) => e.gradeId === gradeId && e.competencyId === competencyId)?.level ?? 0;
  };

  const competencyById = (id: string) => competencies.find((c) => c.id === id);

  const gradeById = (id: string) => grades.find((g) => g.id === id);

  const gapsForTarget = computed(() => {
    const snapshot = assessment.value;
    const targetId = snapshot.targetGradeId;
    return competencies
      .map((comp) => {
        const required = expectationFor(targetId, comp.id);
        const current = snapshot.selfRatings[comp.id] ?? 0;
        const gap = required - current;
        return { competency: comp, required, current, gap };
      })
      .filter((row) => row.gap > 0)
      .sort((a, b) => b.gap - a.gap);
  });

  const radarLabels = computed(() => competencies.map((c) => c.name.split(' ')[0] ?? c.name));

  const radarValues = computed(() => competencies.map((c) => radarScores.value[c.id] ?? 1));

  const radarLegend = computed(() => {
    const grade = gradeById(assessment.value.currentGradeId);
    return grade?.title ?? 'HR';
  });

  const activitiesForGoal = (goalId: string) => idpActivities.filter((a) => a.goalId === goalId);

  const idpProgress = computed(() => {
    const total = idpActivities.length;
    const done = idpActivities.filter((a) => a.done).length;
    return total ? Math.round((done / total) * 100) : 0;
  });

  return {
    competencies,
    grades,
    expectations,
    assessment,
    hasTestResults: hasResults,
    testResult,
    radarLabels,
    radarValues,
    radarLegend,
    idpGoals,
    idpActivities,
    idpCheckpoints,
    expectationFor,
    competencyById,
    gradeById,
    gapsForTarget,
    activitiesForGoal,
    idpProgress
  };
}
