import { isProductionBrowserHost } from '~/utils/productionHost';

/** Превью слайдов на localhost/стейдже. На бое всегда выкл. */
export const POST_VACATION_MEMO_PREVIEW_KEY = 'vbi-pvm-preview';

const isPreviewHost = (): boolean => {
  if (!import.meta.client) return false;
  return !isProductionBrowserHost(window.location.hostname, window.location.port);
};

export const capturePostVacationMemoPreviewFromLocation = (): void => {
  if (!isPreviewHost()) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('pvm') === '1') {
    sessionStorage.setItem(POST_VACATION_MEMO_PREVIEW_KEY, '1');
  }
};

export const isPostVacationMemoPreview = (): boolean => {
  if (!isPreviewHost()) return false;
  capturePostVacationMemoPreviewFromLocation();
  return sessionStorage.getItem(POST_VACATION_MEMO_PREVIEW_KEY) === '1';
};

export const clearPostVacationMemoPreview = (): void => {
  if (!import.meta.client) return;
  sessionStorage.removeItem(POST_VACATION_MEMO_PREVIEW_KEY);
};
