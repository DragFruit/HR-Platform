import { requireRole } from '../../utils/requireRole';
import { mutateSurveys, uniqueSlug } from '../../utils/surveysStore';
import { slugify } from '../../../app/composables/useSurveys';
import type { SurveyQuestion } from '../../../app/composables/useSurveys';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const id = String(getRouterParam(event, 'id') || '').trim();
  const body = await readBody<{
    title?: string;
    description?: string;
    anonymous?: boolean;
    questions?: SurveyQuestion[];
  }>(event);

  const state = await mutateSurveys((current) => {
    const survey = current.surveys.find((s) => s.id === id);
    if (!survey) {
      throw createError({ statusCode: 404, statusMessage: 'Опрос не найден' });
    }
    const today = new Date().toISOString().slice(0, 10);

    if (typeof body?.title === 'string' && body.title.trim()) {
      const title = body.title.trim();
      if (title !== survey.title) {
        survey.slug = uniqueSlug(current, slugify(title), survey.id);
      }
      survey.title = title;
    }
    if (typeof body?.description === 'string') {
      survey.description = body.description.trim() || undefined;
    }
    if (typeof body?.anonymous === 'boolean') {
      survey.anonymous = body.anonymous;
    }
    if (Array.isArray(body?.questions)) {
      survey.questions = body.questions;
    }
    survey.updatedAt = today;
    return current;
  });

  const survey = state.surveys.find((s) => s.id === id);
  return { survey };
});
