/**
 * Автоматическая смена учётного года отпусков 1 января (по Москве).
 * - через 45 с после старта процесса: догон, если сервер лежал в полночь на 1 января;
 * - каждую полночь по Москве: проверка «год по Москве > primaryYear».
 * Переход атомарный и идемпотентный (runVacationYearRollover внутри mutateVacations),
 * поэтому повтор, параллельный процесс или ручной запуск из админки ничего не задвоят.
 * Bitrix не трогает (только данные платформы), поэтому работает на всех стендах.
 * Выключить: VACATION_AUTO_ROLLOVER=0.
 */
import { msUntilNextMoscowMidnight, runScheduledVacationRollover } from '../utils/vacationYearRollover';
import { vacationRolloverDeps } from '../utils/vacationYearRolloverRun';

const STARTUP_DELAY_MS = 45_000;

let running = false;

const runOnce = async (trigger: 'startup' | 'midnight') => {
  if (running) return;
  running = true;
  try {
    const outcome = await runScheduledVacationRollover(vacationRolloverDeps());
    if (outcome?.changed) {
      console.info(
        `[vacation-rollover] ${trigger}: учётный год ${outcome.fromYear} → ${outcome.toYear}, остатков перенесено ${outcome.updated}, без даты приёма ${outcome.skipped.length}, карточки ${outcome.employeesApplied ? 'обновлены' : 'не обновлены (повтор при следующем запуске)'}`
      );
    }
  } catch (err) {
    console.error(`[vacation-rollover] ${trigger}: ошибка перехода года`, err);
  } finally {
    running = false;
  }
};

export default defineNitroPlugin(() => {
  if (process.env.VITEST) return;
  if (String(process.env.VACATION_AUTO_ROLLOVER || '').trim() === '0') return;

  setTimeout(() => void runOnce('startup'), STARTUP_DELAY_MS).unref?.();

  const scheduleMidnight = () => {
    setTimeout(() => {
      void runOnce('midnight').finally(scheduleMidnight);
    }, msUntilNextMoscowMidnight()).unref?.();
  };
  scheduleMidnight();
});
