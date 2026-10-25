import { requireVbiSession } from '../../utils/session';
import { ensureRaceFinalized } from '../../utils/pitStopRaceStore';

/**
 * Победители Pit Stop 14 (топ-3) — только для ачивки `pit-stop-14` в профиле и на визитке.
 * Сам ивент закрыт (страницы/API гонки удалены), данные гонки остаются в хранилище.
 */
export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  const { winners, finalizedAt } = await ensureRaceFinalized();
  return { winners, finalizedAt };
});
