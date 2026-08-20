import { requireRole } from '../../utils/requireRole';
import { yandexChatAnswer } from '../../utils/yandexGpt';

type Body = {
  question?: string;
  context?: string;
};

export default defineEventHandler(async (event) => {
  await requireRole(event, ['employee', 'manager', 'hr', 'admin']);

  const payload = (await readBody<Body>(event)) || {};

  const question = String(payload.question || '').trim();
  if (!question) throw createError({ statusCode: 400, statusMessage: 'question обязателен' });

  const context = String(payload.context || '').trim();
  const answer = await yandexChatAnswer(question, context);

  return { answer };
});

