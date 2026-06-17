import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AdaptationPhaseTemplate,
  AdaptationQuizTemplate,
  AdaptationTrackTemplate,
  QuizQuestion
} from './adaptationTypes';

const TRACK_FILE = join(process.cwd(), 'server/data/adaptation-track.json');

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
  const raw = await readFile(TRACK_FILE, 'utf8');
  const track = JSON.parse(raw) as AdaptationTrackTemplate;
  return {
    ...track,
    phases: track.phases.map(stripPhase)
  };
}

export async function loadTrackFull(): Promise<AdaptationTrackTemplate> {
  const raw = await readFile(TRACK_FILE, 'utf8');
  return JSON.parse(raw) as AdaptationTrackTemplate;
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
