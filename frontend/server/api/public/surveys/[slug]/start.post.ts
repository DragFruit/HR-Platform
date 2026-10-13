import { readSurveys } from '../../../../utils/surveysStore';
import { recordSurveyStart } from '../../../../utils/surveyStartsStore';
import { checkRateLimit } from '../../../../utils/simpleRateLimit';

/**
 * Публичный счётчик "начал отвечать" — вызывается один раз клиентом при
 * первом реальном изменении ответа на любой вопрос (не при загрузке
 * страницы — для этого есть visit.post.ts). Никаких идентифицирующих
 * данных не принимается и не сохраняется — см. surveyCounterStore.ts.
 */
export default defineEventHandler(async (event) => {
  checkRateLimit(event, 'survey-start', 60, 60_000);

  const slug = String(getRouterParam(event, 'slug') || '').trim();
  const surveysState = await readSurveys();
  const survey = surveysState.surveys.find((s) => s.slug === slug);

  if (!survey || survey.status !== 'published') {
    return { ok: true };
  }

  await recordSurveyStart(survey.id);
  return { ok: true };
});
