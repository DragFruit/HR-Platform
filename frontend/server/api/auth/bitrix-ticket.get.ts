import { consumeOAuthLoginTicket } from '../../utils/oauthLoginTicket';
import { setVbiSession } from '../../utils/session';

/** Legacy GET handoff — оставлен для совместимости; основной путь POST form. */
export default defineEventHandler((event) => {
  setHeader(event, 'cache-control', 'no-store, no-cache, must-revalidate');
  setHeader(event, 'x-vbi-auth', 'ticket-v9-get');

  const query = getQuery(event);
  const ticket = Array.isArray(query.ticket) ? String(query.ticket[0] || '') : String(query.ticket || '');
  const user = consumeOAuthLoginTicket(ticket);
  if (!user) {
    return sendRedirect(
      event,
      '/?auth_error=' +
        encodeURIComponent(
          'Сессия входа устарела. Нажмите «Войти через Битрикс24» ещё раз.'
        )
    );
  }

  setVbiSession(event, user);
  return sendRedirect(event, '/?auth=bitrix');
});
