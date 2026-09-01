import { assertCronLocalhostIfRequired, assertCronToken } from '../../utils/cronAuth';
import { runChatgptCodeTelegramSync } from '../../utils/chatgptCodeTelegram';

/**
 * Каждые ~2 мин: IMAP коды ChatGPT → пост в корпоративный Telegram.
 * Защита: X-Cron-Token / ?token= = CRON_SECRET.
 * dry_run=1 — только проверить почту и дедуп, без sendMessage и без записи state.
 */
export default defineEventHandler(async (event) => {
  assertCronToken(event);
  assertCronLocalhostIfRequired(event);

  const query = getQuery(event);
  const dryRun =
    String(query.dry_run || '').trim() === '1' ||
    String(query.dryRun || '').trim() === '1';

  const result = await runChatgptCodeTelegramSync({ dryRun });
  console.info('[chatgpt-code-telegram]', JSON.stringify(result));
  return { ok: true, ...result };
});
