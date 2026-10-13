import { createSurveyCounterStore } from './surveyCounterStore';

/**
 * Счётчик визитов публичной страницы опроса (/s/[slug]) — первая стадия
 * воронки "Посещения → Начали отвечать → Завершили" (см. surveyResults.ts).
 * Идентично-free: только суммарный счётчик на survey.id, см. surveyCounterStore.ts.
 */
const store = createSurveyCounterStore('survey-visits.json', 'visited');

export const readSurveyVisits = store.read;
export const visitsForSurvey = store.countFor;
export const recordSurveyVisit = store.record;
