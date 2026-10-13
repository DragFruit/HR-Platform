import { requireRole } from '../../../utils/requireRole';
import { mutateSurveys } from '../../../utils/surveysStore';

/** Снимает опрос с публикации — переводит в «closed» (не draft: опрос уже мог собирать ответы). */
export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const id = String(getRouterParam(event, 'id') || '').trim();

  const state = await mutateSurveys((current) => {
    const survey = current.surveys.find((s) => s.id === id);
    if (!survey) {
      throw createError({ statusCode: 404, statusMessage: 'Опрос не найден' });
    }
    survey.status = 'closed';
    return current;
  });

  return { survey: state.surveys.find((s) => s.id === id) };
});
