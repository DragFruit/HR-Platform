import type { VacationStoreState } from '../utils/vacationsStore';

/** Сохраняемое состояние «как в файле vacations.json» (без демо-записей QA, до нормализации). */
export type PersistedVacationState = Partial<VacationStoreState>;

/** Кто и откуда меняет отпуска (для аудита и истории статусов). */
export type VacationWriteContext = {
  /** id сотрудника из справочника; null — система / синк Bitrix / cron. */
  actorEmployeeId?: number | null;
  /** Метка источника: api, bitrix-sync, bitrix-maintenance, reservation-lifecycle, rollover, … */
  reason?: string;
};

/**
 * Сырое хранилище отпусков. Бизнес-логика (нормализация, демо-записи QA, мутации заявок
 * и броней, синк Bitrix) — над ним, в vacationsStore.ts и vacation*Mutations.ts, одна на оба бэкенда.
 */
export type VacationsRepo = {
  backend: 'json' | 'postgres';
  readRaw(): Promise<PersistedVacationState>;
  writeRaw(state: PersistedVacationState, ctx?: VacationWriteContext): Promise<void>;
  /**
   * Атомарное «прочитать → изменить → записать»: правки идут строго по очереди
   * (JSON — очередь в процессе; Postgres — очередь + транзакция под advisory lock).
   * Ошибка в fn → ничего не записано.
   */
  mutateRaw(
    fn: (current: PersistedVacationState) => Promise<PersistedVacationState>,
    ctx?: VacationWriteContext
  ): Promise<void>;
};
