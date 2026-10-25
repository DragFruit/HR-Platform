import { readSurveys } from '../../../../utils/surveysStore';
import { mutateSurveyResponses } from '../../../../utils/surveyResponsesStore';
import { validateSurveyAnswers } from '../../../../utils/surveyValidation';
import { checkRateLimit } from '../../../../utils/simpleRateLimit';
import { getVbiSession } from '../../../../utils/session';
import type { SurveyResponse } from '../../../../../app/composables/useSurveys';

/**
 * Публичная отправка ответа — без requireVbiSession (респондент не обязан быть в Vibe).
 * Если опрос anonymous=true — респондент НЕ переносится в ответ вовсе, даже если
 * у вызова случайно была валидная Vibe-сессия (cookie из того же браузера).
 */
export default defineEventHandler(async (event) => {
  checkRateLimit(event, 'survey-submit', 20, 60_000);

  const slug = String(getRouterParam(event, 'slug') || '').trim();
  const surveysState = await readSurveys();
  const survey = surveysState.surveys.find((s) => s.slug === slug);

  if (!survey || survey.status !== 'published') {
    throw createError({ statusCode: 404, statusMessage: 'Опрос недоступен' });
  }

  const body = await readBody<{ answers?: unknown }>(event);
  const validated = validateSurveyAnswers(survey, body?.answers);
  if (!validated.ok) {
    throw createError({ statusCode: 400, statusMessage: validated.error });
  }

  const response: SurveyResponse = {
    id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    surveyId: survey.id,
    submittedAt: new Date().toISOString(),
    answers: validated.answers
  };

  if (!survey.anonymous) {
    // Респондент не обязан быть залогинен — сессия подставляется только если есть
    // и только в неанонимном опросе; getVbiSession (не requireVbiSession) не роняет запрос.
    const session = getVbiSession(event);
    if (session) {
      response.respondent = { userId: session.id, name: session.name };
    }
  }

  await mutateSurveyResponses((current) => {
    const list = current.responses[survey.id] || [];
    list.push(response);
    current.responses[survey.id] = list;
    return current;
  }, { reason: 'surveys:public-submit' }); // без actor: ответ не связываем с сотрудником

  return { ok: true };
});
