import { requireRole } from '../../utils/requireRole';
import { readSurveys } from '../../utils/surveysStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const id = String(getRouterParam(event, 'id') || '').trim();
  const state = await readSurveys();
  const survey = state.surveys.find((s) => s.id === id);
  if (!survey) {
    throw createError({ statusCode: 404, statusMessage: 'Опрос не найден' });
  }
  return { survey };
});
