export type AdminNotificationKind =
  | 'bitrix_employee_name'
  | 'bitrix_employee_title'
  | 'bitrix_vacation_sync_failed'
  | 'tenure_gift_order'
  | 'idea_submitted'
  | 'vpn_peer_delete_failed'
  | 'sales_best_pick_due'
  | 'page_feedback'
  | 'knowledge_ai_degraded'
  | 'bitrix_notify_failed';

export type AdminNotification = {
  id: string;
  kind: AdminNotificationKind;
  employee_id: number;
  employee_name: string;
  created_at: string;
  admin_seen: boolean;
  /** Bitrix field sync */
  bitrix_user_id?: number;
  field?: 'name' | 'title';
  platform_value?: string;
  bitrix_value?: string;
  /** Юбилейный набор */
  years?: number;
  sku?: string;
  order_id?: string;
  /** Банк идей */
  idea_id?: string;
  idea_title?: string;
  /** Синк отпуска в Bitrix */
  vacation_request_id?: number;
  vacation_start?: string;
  vacation_end?: string;
  error_message?: string;
  /** VPN офбординг */
  vpn_peer_names?: string[];
  vpn_panel?: string;
  /** Лучший специалист продаж — выбор за месяц */
  sales_period?: string;
  sales_period_label?: string;
  /** Оценка страницы */
  stars?: number;
  comment?: string;
  page?: string;
  /** id файла в server/data/page-feedback-photos (первое фото, legacy) */
  photo_id?: string;
  /** до 5 фото к оценке */
  photo_ids?: string[];
};

/** Кто и откуда меняет уведомления админки (для аудита). */
export type AdminNotificationsWriteContext = {
  /** id сотрудника из справочника; null — система / синк Bitrix / cron. */
  actorEmployeeId?: number | null;
  /** Метка источника: bitrix-field-sync, tenure-gift-order, admin-seen, … */
  reason?: string;
};

/**
 * Сырое хранилище уведомлений админки. Бизнес-логика (дедуп, «не спамим раз в час»,
 * замена устаревших расхождений с Bitrix) — над ним, в adminNotificationsStore.ts, одна на оба бэкенда.
 */
export type AdminNotificationsRepo = {
  backend: 'json' | 'postgres';
  /** Все записи в порядке файла (новые в конце). */
  readAll(): Promise<AdminNotification[]>;
  countUnseen(): Promise<number>;
  getById(id: string): Promise<AdminNotification | null>;
  /**
   * Атомарное «прочитать → изменить → записать»: fn получает копию списка и меняет её на месте
   * (push / splice / правка полей). Правки идут строго по очереди (JSON — очередь в процессе;
   * Postgres — очередь + транзакция под advisory lock). Ошибка в fn → ничего не записано.
   */
  mutate<T>(fn: (items: AdminNotification[]) => T | Promise<T>, ctx?: AdminNotificationsWriteContext): Promise<T>;
};
