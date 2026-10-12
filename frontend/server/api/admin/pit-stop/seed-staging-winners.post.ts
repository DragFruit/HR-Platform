// QA-сид для стейджа: подставляет реальных победителей гонки pit-stop-14 (сверено с
// продовым /api/event/pit-stop/race/winners), чтобы владелец продукта мог увидеть
// подиум на :8080 до релиза на прод. Одноразовый инструмент на цикл QA этого ивента,
// не продуктовая фича — жёстко заблокирован на production.
import { requireRole } from '../../../utils/requireRole';
import { getDeployAppEnv } from '../../../utils/appEnv';
import { submitLap, ensureRaceFinalized } from '../../../utils/pitStopRaceStore';
import { readEmployees } from '../../../utils/employeesStore';
import { PIT_STOP_STOP_AT } from '../../../../app/events/pit-stop-14/timeline';
import type { CarColorId } from '../../../../app/events/pit-stop-14/trackDrive';

/** Реальные топ-3 по данным прода (userId, имя, лучший круг, мс). */
const WINNERS: Array<{ userId: number; name: string; bestMs: number }> = [
  { userId: 2533, name: 'Лунин Дмитрий', bestMs: 12600 },
  { userId: 2680, name: 'Шашин Данила', bestMs: 13319 },
  { userId: 2697, name: 'Нижегородцев Василий', bestMs: 13583 }
];

const SEED_COLOR: CarColorId = 'violet';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin']);

  // Belt-and-suspenders: даже если этот роут случайно попадёт в прод-билд,
  // он не должен писать тестовые данные в прод-хранилище гонки.
  if (getDeployAppEnv() === 'production') {
    throw createError({
      statusCode: 403,
      statusMessage: 'QA-сид запрещён на production'
    });
  }

  const employees = await readEmployees();
  const departmentOf = (userId: number): string => {
    const emp = employees.find(
      (e) => e.id === userId || e.platform_user_id === userId || e.bitrix_user_id === userId
    );
    return emp?.department ?? '';
  };

  // Логи кругов должны быть ДО момента стопа ивента — иначе ensureRaceFinalized
  // (computeTop3Winners → bestAsOf с cutoff = PIT_STOP_STOP_AT) их отфильтрует,
  // так как реальное время сейчас уже после стопа.
  const seedAt = new Date(Date.parse(PIT_STOP_STOP_AT) - 60_000);

  for (const winner of WINNERS) {
    await submitLap({
      userId: winner.userId,
      name: winner.name,
      department: departmentOf(winner.userId),
      ms: winner.bestMs,
      color: SEED_COLOR,
      at: seedAt
    });
  }

  const { winners, finalizedAt } = await ensureRaceFinalized();

  return { ok: true, winners, finalizedAt };
});
