import { createSurveyCounterStore } from './surveyCounterStore';

/**
 * Счётчик "начал отвечать" — вторая стадия воронки, фиксируется публичным
 * эндпойнтом /api/public/surveys/:slug/start, вызываемым клиентом РОВНО
 * один раз при первом реальном взаимодействии респондента с первым вопросом
 * (не при простой загрузке страницы — это отдельно считает surveyVisitsStore).
 * Идентично-free, как и визиты — см. surveyCounterStore.ts.
 */
const store = createSurveyCounterStore('survey-starts.json', 'started');

export const readSurveyStarts = store.read;
export const startsForSurvey = store.countFor;
export const recordSurveyStart = store.record;
