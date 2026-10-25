/**
 * Обслуживание отпусков в графике отсутствий Bitrix:
 * - через 30 с после старта процесса (деплой / restart);
 * - раз в сутки в 04:00 МСК (01:00 UTC), пока процесс жив (без отдельного systemd-таймера).
 *
 * Бой: повтор failed/skipped синков, перенос отметок из чужого инфоблока (relocateAbsencesToTargetIblock)
 * и сверка дат будущих отпусков (reconcileFutureAbsences).
 * Стейдж/локалка: запись в Bitrix выключена — только сверка в режиме dry-run (чтение + строка в лог),
 * vacations.json не меняется, статусов failed и алертов нет.
 */
import { reconcileFutureAbsences, runBitrixVacationMaintenance } from '../utils/bitrixVacationAbsence';
import { currentBitrixStand } from '../utils/bitrixWriteGuard';
import { mutateVacations, readVacations } from '../utils/vacationsStore';

const STARTUP_DELAY_MS = 30_000;
const DAILY_UTC_HOUR = 1; // 04:00 МСК
const DAY_MS = 24 * 60 * 60 * 1000;

let running = false;

const runOnce = async (trigger: 'startup' | 'daily') => {
  if (running) {
    console.info(`[bitrix-vacation] ${trigger}: предыдущий проход ещё идёт, пропуск`);
    return;
  }
  running = true;
  try {
    if (currentBitrixStand() === 'production') {
      await mutateVacations(async (state) => (await runBitrixVacationMaintenance(state)).state, { reason: 'bitrix-maintenance' });
      console.info(`[bitrix-vacation] ${trigger} retry/relocate/reconcile done`);
    } else {
      // Только чтение: state не пишем.
      await reconcileFutureAbsences(await readVacations());
    }
  } catch (err) {
    console.warn(`[bitrix-vacation] ${trigger} maintenance failed`, err);
  } finally {
    running = false;
  }
};

/** Миллисекунды до следующего DAILY_UTC_HOUR:00 UTC. */
export const msUntilNextDailyRun = (now: Date = new Date()): number => {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DAILY_UTC_HOUR, 0, 0)
  );
  if (next.getTime() <= now.getTime()) next.setTime(next.getTime() + DAY_MS);
  return next.getTime() - now.getTime();
};

export default defineNitroPlugin(() => {
  if (process.env.VITEST) return;

  // Ждём load-bitrix-env и прогрев; не блокируем listen.
  setTimeout(() => void runOnce('startup'), STARTUP_DELAY_MS).unref?.();

  const scheduleDaily = () => {
    setTimeout(() => {
      void runOnce('daily').finally(scheduleDaily);
    }, msUntilNextDailyRun()).unref?.();
  };
  scheduleDaily();
});
