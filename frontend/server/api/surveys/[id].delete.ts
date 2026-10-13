import { requireRole } from '../../utils/requireRole';
import { mutateSurveys } from '../../utils/surveysStore';
import { mutateSurveyResponses } from '../../utils/surveyResponsesStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const id = String(getRouterParam(event, 'id') || '').trim();

  await mutateSurveys((current) => {
    current.surveys = current.surveys.filter((s) => s.id !== id);
    return current;
  });
  await mutateSurveyResponses((current) => {
    delete current.responses[id];
    return current;
  });

  return { ok: true };
});
