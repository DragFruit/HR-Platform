import { requireRole } from '../../../utils/requireRole';
import { mutateSurveys } from '../../../utils/surveysStore';
import { sessionActorEmployeeId } from '../../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin', 'hr']);
  const id = String(getRouterParam(event, 'id') || '').trim();

  const state = await mutateSurveys((current) => {
    const survey = current.surveys.find((s) => s.id === id);
    if (!survey) {
      throw createError({ statusCode: 404, statusMessage: 'Опрос не найден' });
    }
    if (!survey.questions.length) {
      throw createError({ statusCode: 400, statusMessage: 'Нужен хотя бы один вопрос' });
    }
    survey.status = 'published';
    survey.publishedAt = survey.publishedAt || new Date().toISOString();
    return current;
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'surveys:publish' });

  return { survey: state.surveys.find((s) => s.id === id) };
});
