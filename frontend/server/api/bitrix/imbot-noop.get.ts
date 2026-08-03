/**
 * Bitrix может дергать EVENT handler GET-ом при проверке.
 */
export default defineEventHandler(async () => {
  return { ok: true };
});
