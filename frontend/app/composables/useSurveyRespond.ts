import type { PublicSurvey, SurveyAnswerValue } from '~/composables/useSurveys';

type FetchResult =
  | { state: 'loading' }
  | { state: 'unavailable' }
  | { state: 'ready'; survey: PublicSurvey };

/** Композабл для публичной страницы /s/[slug] — без auth, без Vibe-состояния. */
export function useSurveyRespond(slug: string) {
  const result = ref<FetchResult>({ state: 'loading' });
  const submitting = ref(false);
  const submitted = ref(false);
  const submitError = ref('');

  const load = async () => {
    result.value = { state: 'loading' };
    try {
      const payload = await $fetch<{ available: boolean; survey?: PublicSurvey }>(
        `/api/public/surveys/${encodeURIComponent(slug)}`
      );
      if (payload.available && payload.survey) {
        result.value = { state: 'ready', survey: payload.survey };
      } else {
        result.value = { state: 'unavailable' };
      }
    } catch {
      result.value = { state: 'unavailable' };
    }
  };

  /** Фиксирует визит публичной страницы — вызывать один раз из onMounted. */
  const recordVisit = async (): Promise<void> => {
    try {
      await $fetch(`/api/public/surveys/${encodeURIComponent(slug)}/visit`, { method: 'POST' });
    } catch {
      // Не критично — страница продолжает работать без отметки визита.
    }
  };

  /** Фиксирует "начал отвечать" — вызывать один раз при первом реальном ответе. */
  const recordStart = async (): Promise<void> => {
    try {
      await $fetch(`/api/public/surveys/${encodeURIComponent(slug)}/start`, { method: 'POST' });
    } catch {
      // Не критично — страница продолжает работать без отметки старта.
    }
  };

  const submit = async (answers: Record<string, SurveyAnswerValue>): Promise<boolean> => {
    submitting.value = true;
    submitError.value = '';
    try {
      await $fetch(`/api/public/surveys/${encodeURIComponent(slug)}/submit`, {
        method: 'POST',
        body: { answers }
      });
      submitted.value = true;
      return true;
    } catch (error: unknown) {
      const statusMessage =
        error && typeof error === 'object' && 'data' in error
          ? String((error as { data?: { statusMessage?: string } }).data?.statusMessage || '')
          : '';
      submitError.value = statusMessage || 'Не удалось отправить ответ. Попробуйте ещё раз.';
      return false;
    } finally {
      submitting.value = false;
    }
  };

  return { result, load, recordVisit, recordStart, submit, submitting, submitted, submitError };
}
