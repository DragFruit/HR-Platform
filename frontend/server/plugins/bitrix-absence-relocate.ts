/**
 * После старта боевого процесса (деплой / restart): повтор failed/skipped синков отпусков и перенос
 * отметок, записанных не в текущий график отсутствий (см. relocateAbsencesToTargetIblock).
 * Стейдж/локалка — не запускаем (запись в Bitrix там выключена).
 */
import { retryFailedBitrixVacationSyncs } from '../utils/bitrixVacationAbsence';
import { currentBitrixStand } from '../utils/bitrixWriteGuard';
import { mutateVacations } from '../utils/vacationsStore';

export default defineNitroPlugin(() => {
  // Ждём load-bitrix-env и прогрев; не блокируем listen.
  setTimeout(() => {
    if (currentBitrixStand() !== 'production') return;
    void mutateVacations((state) => retryFailedBitrixVacationSyncs(state))
      .then(() => console.info('[bitrix-vacation] startup retry/relocate done'))
      .catch((err) => console.warn('[bitrix-vacation] startup retry/relocate failed', err));
  }, 30_000);
});
