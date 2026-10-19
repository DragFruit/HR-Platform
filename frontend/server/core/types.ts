import type { ServerEmployee } from '../utils/employeesStore';
import type { ManagerAssignments } from '../utils/employeeManagersStore';
import type { OrgStructureState } from '../utils/orgStructureStore';

/** Кто и откуда меняет данные (для аудита и истории). */
export type CoreWriteContext = {
  /** id сотрудника из справочника; null — система / синк Bitrix / cron. */
  actorEmployeeId?: number | null;
  /** Метка источника для аудита: api, bitrix-sync, rollover, denylist, … */
  reason?: string;
};

/**
 * Сырое хранилище домена core: только чтение/запись «как в файле».
 * Бизнес-логика (дедуп, denylist, overlay руководителей, QA-сотрудники) — над ним,
 * в employeesStore / employeeManagersStore / orgStructureStore, одна на оба бэкенда.
 */
export type CoreRepo = {
  backend: 'json' | 'postgres';
  readEmployeesRaw(): Promise<ServerEmployee[]>;
  writeEmployeesRaw(list: ServerEmployee[], ctx?: CoreWriteContext): Promise<void>;
  readManagerAssignmentsRaw(): Promise<ManagerAssignments>;
  writeManagerAssignmentsRaw(assignments: ManagerAssignments, ctx?: CoreWriteContext): Promise<void>;
  /** Без нормализации — её делает orgStructureStore. */
  readOrgStructureRaw(): Promise<Partial<OrgStructureState>>;
  writeOrgStructureRaw(state: OrgStructureState, ctx?: CoreWriteContext): Promise<void>;
};
