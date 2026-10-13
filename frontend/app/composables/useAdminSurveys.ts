import type { Survey, SurveyQuestion } from '~/composables/useSurveys';
import type { SurveyResultsSummary } from '../../server/utils/surveyResults';

export type AdminSurveyListItem = Survey & { responseCount: number };

export function useAdminSurveys() {
  const surveys = useState<AdminSurveyListItem[]>('vbi-admin-surveys', () => []);
  const hydrated = useState('vbi-admin-surveys-hydrated', () => false);

  const fetchList = async () => {
    try {
      const payload = await $fetch<{ surveys: AdminSurveyListItem[] }>('/api/surveys');
      surveys.value = payload.surveys;
    } catch {
      surveys.value = [];
    }
    hydrated.value = true;
  };

  const createSurvey = async (title: string): Promise<Survey | null> => {
    try {
      const payload = await $fetch<{ survey: Survey }>('/api/surveys', {
        method: 'POST',
        body: { title }
      });
      return payload.survey;
    } catch {
      return null;
    }
  };

  const fetchOne = async (id: string): Promise<Survey | null> => {
    try {
      const payload = await $fetch<{ survey: Survey }>(`/api/surveys/${encodeURIComponent(id)}`);
      return payload.survey;
    } catch {
      return null;
    }
  };

  const updateSurvey = async (
    id: string,
    patch: { title?: string; description?: string; anonymous?: boolean; questions?: SurveyQuestion[] }
  ): Promise<Survey | null> => {
    try {
      const payload = await $fetch<{ survey: Survey }>(`/api/surveys/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: patch
      });
      return payload.survey;
    } catch {
      return null;
    }
  };

  const publishSurvey = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      await $fetch(`/api/surveys/${encodeURIComponent(id)}/publish`, { method: 'POST' });
      return { ok: true };
    } catch (error: unknown) {
      const statusMessage =
        error && typeof error === 'object' && 'data' in error
          ? String((error as { data?: { statusMessage?: string } }).data?.statusMessage || '')
          : '';
      return { ok: false, error: statusMessage || 'Не удалось опубликовать' };
    }
  };

  const unpublishSurvey = async (id: string): Promise<boolean> => {
    try {
      await $fetch(`/api/surveys/${encodeURIComponent(id)}/unpublish`, { method: 'POST' });
      return true;
    } catch {
      return false;
    }
  };

  const deleteSurvey = async (id: string): Promise<boolean> => {
    try {
      await $fetch(`/api/surveys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      surveys.value = surveys.value.filter((s) => s.id !== id);
      return true;
    } catch {
      return false;
    }
  };

  const fetchResults = async (
    id: string
  ): Promise<{ survey: Survey; results: SurveyResultsSummary } | null> => {
    try {
      return await $fetch<{ survey: Survey; results: SurveyResultsSummary }>(
        `/api/surveys/${encodeURIComponent(id)}/results`
      );
    } catch {
      return null;
    }
  };

  const publicUrl = (slug: string) => {
    if (import.meta.client) {
      return `${window.location.origin}/s/${slug}`;
    }
    return `/s/${slug}`;
  };

  return {
    surveys,
    hydrated,
    fetchList,
    createSurvey,
    fetchOne,
    updateSurvey,
    publishSurvey,
    unpublishSurvey,
    deleteSurvey,
    fetchResults,
    publicUrl
  };
}
