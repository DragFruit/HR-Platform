import { randomUUID } from 'node:crypto';
import { requireVbiSession } from '../../utils/session';
import { findEmployeeForSession } from '../../utils/employeesStore';
import { findQuizById } from '../../utils/trackLoader';
import { scoreQuiz } from '../../utils/scoreQuiz';
import { addAttempt } from '../../utils/adaptationStore';
import type { AdaptationAnswer } from '../../utils/adaptationTypes';
import { sessionActorEmployeeId } from '../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{
    quiz_id?: string;
    answers?: AdaptationAnswer[];
  }>(event);

  if (!body?.quiz_id || !Array.isArray(body.answers)) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите quiz_id и answers' });
  }

  const employee = await findEmployeeForSession(session);
  if (!employee) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Сотрудник не найден в справочнике. Обратитесь к HR.'
    });
  }

  const quiz = await findQuizById(body.quiz_id);
  if (!quiz) {
    throw createError({ statusCode: 404, statusMessage: 'Тест не найден' });
  }

  const passing_score = quiz.passing_score ?? 70;
  const { score_percent, passed } = scoreQuiz(quiz.questions, body.answers, passing_score);
  const attempt = await addAttempt({
    id: randomUUID(),
    employee_id: employee.id,
    employee_name: employee.name,
    platform_user_id: session.id,
    quiz_id: quiz.id,
    phase: quiz.phase,
    quiz_title: quiz.title,
    answers: body.answers,
    score_percent,
    passed: score_percent >= passing_score,
    submitted_at: new Date().toISOString(),
    admin_seen: false
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'adaptation:attempt' });

  return {
    attempt,
    passed: attempt.passed,
    score_percent: attempt.score_percent,
    passing_score
  };
});
