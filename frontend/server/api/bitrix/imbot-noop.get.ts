/**
 * Bitrix может дергать EVENT handler GET-ом при проверке.
 * Публичный stub без данных — намеренно открыт (health для портала).
 */
export default defineEventHandler(async () => {
  return { ok: true };
});
