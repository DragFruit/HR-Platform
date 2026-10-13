import { requireRole } from '../../../utils/requireRole';
import { readSurveys } from '../../../utils/surveysStore';
import { readSurveyResponses, responsesForSurvey } from '../../../utils/surveyResponsesStore';
import { buildSurveyResults } from '../../../utils/surveyResults';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const id = String(getRouterParam(event, 'id') || '').trim();

  const surveysState = await readSurveys();
  const survey = surveysState.surveys.find((s) => s.id === id);
  if (!survey) {
    throw createError({ statusCode: 404, statusMessage: 'Опрос не найден' });
  }

  const responsesState = await readSurveyResponses();
  const responses = responsesForSurvey(responsesState, id);
  const results = buildSurveyResults(survey, responses);

  return { survey, results };
});
