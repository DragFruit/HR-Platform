import type {
  AdaptationPhaseTemplate,
  AdaptationQuizTemplate,
  AdaptationTrackTemplate,
  QuizQuestion
} from './adaptationTypes';
import trackSeed from '../data/adaptation-track.json';

function cloneTrack(track: AdaptationTrackTemplate): AdaptationTrackTemplate {
  return structuredClone(track);
}

function stripCorrect(q: QuizQuestion): Omit<QuizQuestion, 'correct'> & { correct?: never } {
  const { correct: _c, ...rest } = q;
  return rest;
}

function stripQuiz(quiz: AdaptationQuizTemplate) {
  return {
    ...quiz,
    questions: quiz.questions.map(stripCorrect)
  };
}

function stripPhase(phase: AdaptationPhaseTemplate) {
  return {
    ...phase,
    quiz: phase.quiz ? stripQuiz(phase.quiz) : null
  };
}

export async function loadTrackForClient(): Promise<AdaptationTrackTemplate> {
  const track = cloneTrack(trackSeed as AdaptationTrackTemplate);
  return {
    ...track,
    phases: track.phases.map(stripPhase)
  };
}

export async function loadTrackFull(): Promise<AdaptationTrackTemplate> {
  return cloneTrack(trackSeed as AdaptationTrackTemplate);
}

export async function findQuizById(quizId: string): Promise<AdaptationQuizTemplate | null> {
  const track = await loadTrackFull();
  for (const phase of track.phases) {
    if (phase.quiz?.id === quizId) return phase.quiz;
  }
  return null;
}

export function daysSinceHire(hiredAt: string): number {
  const hire = new Date(hiredAt);
  const now = new Date();
  hire.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24));
}
