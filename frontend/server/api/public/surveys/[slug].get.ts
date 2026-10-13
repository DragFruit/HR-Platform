import { readSurveys } from '../../../utils/surveysStore';
import type { PublicSurvey } from '../../../../app/composables/useSurveys';

/**
 * Публичный эндпойнт — без requireVbiSession. Отдаёт опрос респонденту
 * только если он published; никаких служебных полей (createdBy, id, статус).
 */
export default defineEventHandler(async (event) => {
  const slug = String(getRouterParam(event, 'slug') || '').trim();
  const state = await readSurveys();
  const survey = state.surveys.find((s) => s.slug === slug);

  if (!survey || survey.status !== 'published') {
    return { available: false as const };
  }

  const publicSurvey: PublicSurvey = {
    slug: survey.slug,
    title: survey.title,
    ...(survey.description ? { description: survey.description } : {}),
    anonymous: survey.anonymous,
    questions: survey.questions
  };

  return { available: true as const, survey: publicSurvey };
});
