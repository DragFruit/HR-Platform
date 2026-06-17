import type { AdaptationAnswer, QuizQuestion } from './adaptationTypes';

function normalizeMulti(value: string | string[] | number): string[] {
  if (Array.isArray(value)) return value.map(String).sort();
  return [String(value)];
}

function scoreQuestion(question: QuizQuestion, answer: AdaptationAnswer | undefined): number {
  if (!answer) return 0;

  if (question.type === 'scale') {
    const min = question.scale_min ?? 1;
    const max = question.scale_max ?? 5;
    const num = Number(answer.value);
    if (Number.isNaN(num) || num < min || num > max) return 0;
    return 1;
  }

  if (!question.correct) return 1;

  if (question.type === 'single') {
    return String(answer.value) === String(question.correct) ? 1 : 0;
  }

  if (question.type === 'multi') {
    const expected = normalizeMulti(question.correct as string | string[]);
    const given = normalizeMulti(answer.value);
    if (expected.length !== given.length) return 0;
    return expected.every((v, i) => v === given[i]) ? 1 : 0;
  }

  return 0;
}

export function scoreQuiz(
  questions: QuizQuestion[],
  answers: AdaptationAnswer[],
  passingScore = 70
): { score_percent: number; passed: boolean; passing_score: number } {
  const scorable = questions.filter((q) => q.type !== 'scale' && q.correct != null);
  const scaleQuestions = questions.filter((q) => q.type === 'scale');

  let earned = 0;
  let total = scorable.length;

  scorable.forEach((q) => {
    const ans = answers.find((a) => a.question_id === q.id);
    earned += scoreQuestion(q, ans);
  });

  scaleQuestions.forEach((q) => {
    const ans = answers.find((a) => a.question_id === q.id);
    if (scoreQuestion(q, ans) > 0) earned += 1;
    total += 1;
  });

  if (total === 0) {
    return { score_percent: 100, passed: true, passing_score: passingScore };
  }

  const score_percent = Math.round((earned / total) * 100);
  return {
    score_percent,
    passed: score_percent >= passingScore,
    passing_score: passingScore
  };
}
