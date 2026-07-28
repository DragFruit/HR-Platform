import { requireVbiSession } from '../../utils/session';
import { findEmployeeForSession } from '../../utils/employeesStore';
import { listAttempts, listStepCompletions } from '../../utils/adaptationStore';
import { daysSinceHire, loadTrackForClient } from '../../utils/trackLoader';
import {
  applyScenarioToTrack,
  findAdaptationScenario,
  getAssignmentForEmployee
} from '../../utils/adaptationScenarios';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const employee = await findEmployeeForSession(session);

  if (!employee) {
    return {
      employee: null,
      track: await loadTrackForClient(),
      scenario: null,
      days_since_hire: null,
      attempts: [],
      step_completions: [],
      progress_percent: 0
    };
  }

  const assignment = await getAssignmentForEmployee(employee.id);
  const scenario = assignment
    ? await findAdaptationScenario(assignment.scenario_id)
    : null;
  const baseTrack = await loadTrackForClient();
  const track = applyScenarioToTrack(baseTrack, scenario);
  const days = daysSinceHire(employee.hired_at);
  const attempts = await listAttempts({ platform_user_id: session.id });
  const stepCompletions = await listStepCompletions(employee.id);

  const totalSteps = track.phases.reduce((sum, p) => sum + p.steps.length, 0);
  const totalQuizzes = track.phases.filter((p) => p.quiz).length;
  const completedSteps = stepCompletions.length;
  const passedQuizzes = new Set(
    attempts.filter((a) => a.passed).map((a) => a.quiz_id)
  ).size;
  const totalItems = totalSteps + totalQuizzes;
  const doneItems = completedSteps + passedQuizzes;
  const progress_percent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const phases = track.phases.map((phase) => {
    const unlocked =
      days >= phase.due_day_from && days <= phase.due_day_to + 14;
    const overdue = days > phase.due_day_to;
    const quizAttempt = phase.quiz
      ? attempts.find((a) => a.quiz_id === phase.quiz!.id)
      : null;
    return {
      ...phase,
      unlocked,
      overdue,
      quiz_passed: quizAttempt?.passed ?? false,
      quiz_score: quizAttempt?.score_percent ?? null,
      steps: phase.steps.map((step) => ({
        ...step,
        completed: stepCompletions.some((c) => c.step_id === step.id)
      }))
    };
  });

  return {
    employee,
    track: { ...track, phases },
    scenario: scenario
      ? {
          id: scenario.id,
          title: scenario.title,
          short_title: scenario.short_title,
          description: scenario.description
        }
      : null,
    days_since_hire: days,
    attempts,
    step_completions: stepCompletions,
    progress_percent
  };
});
