/**
 * Заглушка для EVENT_* чат-бота Bitrix (ответы на сообщения боту не нужны).
 * Регистрация бота требует URL обработчика.
 */
export default defineEventHandler(async () => {
  return { ok: true };
});
