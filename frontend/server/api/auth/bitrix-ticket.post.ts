import { consumeOAuthLoginTicket } from '../../utils/oauthLoginTicket';
import { setVbiSession } from '../../utils/session';

/**
 * First-party обмен билета на cookie.
 * Form POST из handoff HTML после Bitrix — основной путь (Set-Cookie надёжно).
 * JSON POST — для app.vue / $fetch.
 * Redirect относительный: CSP form-action 'self' блокирует Location на другой порт.
 */
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store, no-cache, must-revalidate');
  setHeader(event, 'x-vbi-auth', 'ticket-v9');

  const body = await readBody<{ ticket?: string }>(event);
  const ticket = String(body?.ticket || '');
  const user = consumeOAuthLoginTicket(ticket);
  if (!user) {
    const contentType = String(getHeader(event, 'content-type') || '');
    if (contentType.includes('application/json')) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Сессия входа устарела. Нажмите «Войти через Битрикс24» ещё раз.'
      });
    }
    return sendRedirect(
      event,
      '/?auth_error=' +
        encodeURIComponent(
          'Сессия входа устарела. Нажмите «Войти через Битрикс24» ещё раз.'
        )
    );
  }

  setVbiSession(event, user);

  const contentType = String(getHeader(event, 'content-type') || '');
  if (contentType.includes('application/json')) {
    return { ok: true, user };
  }

  return sendRedirect(event, '/?auth=bitrix');
});
