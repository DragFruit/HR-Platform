import {
  HR_KNOWLEDGE_BLOCKS,
  HR_KNOWLEDGE_QUIZ_ID,
  percentToCompetencyLevel,
  percentToRadarScore,
  scoreBlockAnswers,
  type HrQuizBlock
} from '~/data/hrKnowledgeTest';
import type { CompetencyLevel } from '~/composables/useHrDevelopment';

export type HrBlockScore = {
  percent: number;
  radar: number;
  level: CompetencyLevel;
  correct: number;
  total: number;
};

export type HrTestResult = {
  quizId: string;
  completedAt: string;
  overallPercent: number;
  blockScores: Record<string, HrBlockScore>;
  taskId?: number;
};

const STORAGE_KEY = 'vbi-hr-test-results-v1';

export function useHrKnowledgeTest() {
  const result = useState<HrTestResult | null>('vbi-hr-test-result', () => null);
  const hydrated = useState<boolean>('vbi-hr-test-hydrated', () => false);

  const blocks = HR_KNOWLEDGE_BLOCKS;

  const hydrate = () => {
    if (!import.meta.client || hydrated.value) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        result.value = JSON.parse(raw) as HrTestResult;
      } catch {
        result.value = null;
      }
    }
    hydrated.value = true;
  };

  const persist = (payload: HrTestResult) => {
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    result.value = payload;
  };

  const hasResults = computed(() => Boolean(result.value?.blockScores));

  const radarScores = computed(() => {
    const scores: Record<string, number> = {};
    for (const block of blocks) {
      scores[block.competencyId] = result.value?.blockScores[block.competencyId]?.radar ?? 1;
    }
    return scores;
  });

  const competencyLevels = computed(() => {
    const levels: Record<string, CompetencyLevel> = {};
    for (const block of blocks) {
      levels[block.competencyId] = result.value?.blockScores[block.competencyId]?.level ?? 0;
    }
    return levels;
  });

  const submitAnswers = (answers: Record<string, string>, taskId?: number): HrTestResult => {
    const blockScores: Record<string, HrBlockScore> = {};
    let totalCorrect = 0;
    let totalQuestions = 0;

    for (const block of blocks) {
      const scored = scoreBlockAnswers(block, answers);
      blockScores[block.competencyId] = {
        ...scored,
        radar: percentToRadarScore(scored.percent),
        level: percentToCompetencyLevel(scored.percent)
      };
      totalCorrect += scored.correct;
      totalQuestions += scored.total;
    }

    const overallPercent = totalQuestions
      ? Math.round((totalCorrect / totalQuestions) * 100)
      : 0;

    const payload: HrTestResult = {
      quizId: HR_KNOWLEDGE_QUIZ_ID,
      completedAt: new Date().toISOString().slice(0, 10),
      overallPercent,
      blockScores,
      taskId
    };

    persist(payload);
    return payload;
  };

  const blockByCompetency = (competencyId: string): HrQuizBlock | undefined =>
    blocks.find((b) => b.competencyId === competencyId);

  return {
    blocks,
    result,
    hasResults,
    radarScores,
    competencyLevels,
    hydrate,
    submitAnswers,
    blockByCompetency
  };
}
