import { readSurveys } from '../../../../utils/surveysStore';
import { recordSurveyVisit } from '../../../../utils/surveyVisitsStore';
import { checkRateLimit } from '../../../../utils/simpleRateLimit';

/**
 * Публичный счётчик визитов — вызывается один раз при загрузке /s/[slug]
 * (onMounted), до того как респондент начал отвечать или отправил ответ.
 * Никаких идентифицирующих данных не принимается и не сохраняется —
 * см. комментарий в surveyVisitsStore.ts.
 */
export default defineEventHandler(async (event) => {
  checkRateLimit(event, 'survey-visit', 60, 60_000);

  const slug = String(getRouterParam(event, 'slug') || '').trim();
  const surveysState = await readSurveys();
  const survey = surveysState.surveys.find((s) => s.slug === slug);

  // Тихо игнорируем несуществующий/неопубликованный опрос — это не ошибка
  // клиента, страница уже показывает "недоступен" своим путём.
  if (!survey || survey.status !== 'published') {
    return { ok: true };
  }

  await recordSurveyVisit(survey.id);
  return { ok: true };
});
