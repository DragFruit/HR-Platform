import { requireRole } from '../../utils/requireRole';
import { mutateSurveys, uniqueSlug } from '../../utils/surveysStore';
import { slugify } from '../../../app/composables/useSurveys';
import type { Survey } from '../../../app/composables/useSurveys';
import { sessionActorEmployeeId } from '../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin', 'hr']);
  const body = await readBody<{ title?: string }>(event);
  const title = String(body?.title || '').trim() || 'Новый опрос';
  const today = new Date().toISOString().slice(0, 10);

  const state = await mutateSurveys((current) => {
    const id = `survey-${current.nextSurveyId}`;
    const slug = uniqueSlug(current, slugify(title));
    const survey: Survey = {
      id,
      slug,
      title,
      status: 'draft',
      anonymous: false,
      questions: [],
      createdByUserId: session.id,
      createdByName: session.name,
      createdAt: today,
      updatedAt: today
    };
    current.surveys.push(survey);
    current.nextSurveyId += 1;
    return current;
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'surveys:create' });

  const created = state.surveys[state.surveys.length - 1];
  return { survey: created };
});
