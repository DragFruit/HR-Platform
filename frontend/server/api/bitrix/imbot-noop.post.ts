/**
 * Заглушка для EVENT_* чат-бота Bitrix (ответы на сообщения боту не нужны).
 * Регистрация бота требует публичный URL без сессии Vibe — только `{ ok: true }`.
 * Правки на портале не делаем.
 */
export default defineEventHandler(async () => {
  return { ok: true };
});
