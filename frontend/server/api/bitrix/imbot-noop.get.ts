/**
 * Bitrix может дергать EVENT handler GET-ом при проверке URL обработчика.
 * Публичный stub без данных — намеренно открыт: портал ходит без cookie Vibe,
 * закрывать сессией нельзя. Правки на crm.vbi.ru не требуются и не делаем.
 */
export default defineEventHandler(async () => {
  return { ok: true };
});
