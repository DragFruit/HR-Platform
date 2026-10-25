import { requireRole } from '../../utils/requireRole';
import { mutateSurveys } from '../../utils/surveysStore';
import { mutateSurveyResponses } from '../../utils/surveyResponsesStore';
import { sessionActorEmployeeId } from '../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin', 'hr']);
  const id = String(getRouterParam(event, 'id') || '').trim();

  await mutateSurveys((current) => {
    current.surveys = current.surveys.filter((s) => s.id !== id);
    return current;
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'surveys:delete' });
  await mutateSurveyResponses((current) => {
    delete current.responses[id];
    return current;
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'surveys:delete' });

  return { ok: true };
});
