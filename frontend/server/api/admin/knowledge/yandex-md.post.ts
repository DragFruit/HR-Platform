import { requireRole } from '../../../utils/requireRole';
import { yandexToMarkdown } from '../../../utils/yandexGpt';

type Body = {
  text?: string;
};

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin']);
  const payload = (await readBody<Body>(event)) || {};

  const text = String(payload.text || '').trim();
  if (!text) {
    throw createError({ statusCode: 400, statusMessage: 'text обязателен' });
  }

  const markdown = await yandexToMarkdown(text);
  return { markdown };
});

