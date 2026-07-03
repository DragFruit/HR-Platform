import { requireVbiSession } from '../../utils/session';

/** @deprecated Клиент сохраняет заявки по одной: POST/PATCH/DELETE /api/vacations/requests */
export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  throw createError({
    statusCode: 410,
    statusMessage:
      'Полная перезапись отключена. Используйте POST/PATCH/DELETE /api/vacations/requests'
  });
});
