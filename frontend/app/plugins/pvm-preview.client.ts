import { capturePostVacationMemoPreviewFromLocation } from '~/utils/postVacationMemoPreview';

/** Срабатывает на экране логина, до монтирования памятки — иначе ?pvm=1 теряется после входа. */
export default defineNuxtPlugin(() => {
  capturePostVacationMemoPreviewFromLocation();
});
