import { requireRole } from '../../utils/requireRole';
import { readSurveys } from '../../utils/surveysStore';
import { readSurveyResponses, responsesForSurvey } from '../../utils/surveyResponsesStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const surveys = await readSurveys();
  const responsesState = await readSurveyResponses();

  return {
    surveys: surveys.surveys
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((survey) => ({
        ...survey,
        responseCount: responsesForSurvey(responsesState, survey.id).length
      }))
  };
});
